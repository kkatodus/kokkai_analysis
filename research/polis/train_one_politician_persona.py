import argparse
import torch
from datasets import load_dataset
from transformers import (
    AutoModelForCausalLM, 
    AutoTokenizer, 
    BitsAndBytesConfig
)
from peft import LoraConfig
from trl import DPOTrainer, DPOConfig

def main():
    parser = argparse.ArgumentParser(description="DPO LoRA Fine-Tuning Script")
    parser.add_argument("--data", type=str, required=True, help="Path to the JSONL dataset file")
    parser.add_argument(
        "--model",
        type=str,
        default="Qwen/Qwen2.5-0.5B-Instruct",
        help="Hugging Face model ID. Defaults to a tiny ungated model for quick testing.",
    )
    parser.add_argument("--output", type=str, required=True, help="Output directory for the LoRA adapter")
    parser.add_argument("--epochs", type=int, default=1, help="Number of training epochs")
    parser.add_argument("--quantize", action="store_true", help="Load model in 4-bit for lower VRAM usage")
    args = parser.parse_args()

    # 1. Load and format dataset
    print(f"Loading dataset from {args.data}...")
    dataset = load_dataset("json", data_files=args.data, split="train")

    # DPOTrainer expects columns named 'prompt', 'chosen', and 'rejected'.
    # The dataset may store the preferred response under 'accepted'; normalize it.
    if "accepted" in dataset.column_names and "chosen" not in dataset.column_names:
        dataset = dataset.rename_column("accepted", "chosen")

    # 2. Setup Tokenizer
    tokenizer = AutoTokenizer.from_pretrained(args.model)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    # 3. Setup Model with optional 4-bit quantization
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
    ) if args.quantize else None

    print(f"Loading model {args.model}...")
    model = AutoModelForCausalLM.from_pretrained(
        args.model,
        device_map="auto",
        torch_dtype=torch.bfloat16,
        quantization_config=bnb_config,
    )

    # 4. Configure LoRA
    # We target standard attention layers for Llama/Mistral architectures.
    peft_config = LoraConfig(
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj"] 
    )

    # 5. Training config optimized for memory (TRL >= 1.x uses DPOConfig).
    # DPO-specific args like `beta` and `max_length` now live on DPOConfig.
    training_args = DPOConfig(
        output_dir=args.output,
        per_device_train_batch_size=1, # DPO is extremely memory heavy
        gradient_accumulation_steps=8, # Compensate for small batch size
        gradient_checkpointing=True,   # Crucial for avoiding OOM
        learning_rate=5e-5,
        num_train_epochs=args.epochs,
        logging_steps=10,
        save_steps=100,
        save_total_limit=2,
        remove_unused_columns=False, # Must be False for DPOTrainer
        bf16=True,
        optim="paged_adamw_8bit" if args.quantize else "adamw_torch",
        report_to="none",
        beta=0.1,        # DPO temperature/divergence penalty
        max_length=1024, # Max length of prompt + completion
    )

    # 6. Initialize DPOTrainer
    # When peft_config is passed, TRL automatically uses the unadapted base model as the reference model.
    trainer = DPOTrainer(
        model=model,
        ref_model=None,
        args=training_args,
        train_dataset=dataset,
        processing_class=tokenizer,
        peft_config=peft_config,
    )

    # 7. Train and Save
    print("Starting DPO training...")
    trainer.train()
    
    print(f"Saving LoRA adapter to {args.output}...")
    trainer.save_model(args.output)
    tokenizer.save_pretrained(args.output)

if __name__ == "__main__":
    main()
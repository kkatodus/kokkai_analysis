import argparse
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel


def main():
    parser = argparse.ArgumentParser(description="Load a trained LoRA adapter and validate it on a prompt")
    parser.add_argument("--base", type=str, default="Qwen/Qwen2.5-0.5B-Instruct", help="Base model ID")
    parser.add_argument("--adapter", type=str, required=True, help="Path to the trained LoRA adapter directory")
    parser.add_argument(
        "--prompt",
        type=str,
        default=(
            "<|system|>\n"
            "You are simulating Representative Tanaka Yuki, a Japanese Diet member who supports "
            "strengthening national defence and increasing the defence budget in response to regional "
            "security challenges. Answer in the politician's voice, concisely and consistently with this position.\n"
            "<|user|>\n"
            "Should Japan increase its defence budget over the next five years?\n"
            "<|assistant|>\n"
        ),
        help="Prompt to test (defaults to an example from the training data)",
    )
    args = parser.parse_args()

    tokenizer = AutoTokenizer.from_pretrained(args.base)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    def generate(model):
        inputs = tokenizer(args.prompt, return_tensors="pt").to(model.device)
        with torch.no_grad():
            output_ids = model.generate(
                **inputs,
                max_new_tokens=200,
                do_sample=False,
                pad_token_id=tokenizer.pad_token_id,
            )
        return tokenizer.decode(
            output_ids[0][inputs["input_ids"].shape[1]:],
            skip_special_tokens=True,
        ).strip()

    print(f"Loading base model {args.base}...")
    base_model = AutoModelForCausalLM.from_pretrained(
        args.base,
        device_map="auto",
        dtype=torch.bfloat16,
    )
    base_model.eval()

    # Generate from the base model BEFORE attaching the adapter so the
    # comparison reflects the untrained baseline.
    print("Generating base model response...")
    base_response = generate(base_model)

    print(f"Loading LoRA adapter from {args.adapter}...")
    adapter_model = PeftModel.from_pretrained(base_model, args.adapter)
    adapter_model.eval()

    print("Generating adapter response...")
    adapter_response = generate(adapter_model)

    sep = "=" * 70
    print("\n" + sep)
    print("PROMPT:")
    print(args.prompt)
    print(sep)
    print(f"BASE MODEL ({args.base}):")
    print(base_response)
    print(sep)
    print("BASE MODEL + LoRA ADAPTER:")
    print(adapter_response)
    print(sep)
    if base_response == adapter_response:
        print("NOTE: Responses are identical — the adapter had no visible effect on this prompt.")
    else:
        print("NOTE: Responses differ — the adapter changed the output.")
    print(sep)


if __name__ == "__main__":
    main()

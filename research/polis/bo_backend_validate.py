"""Phase-0 BO backend validation.

Synthetic stand-in for the POLIS mixing-coefficient objective (spec §2.4):
- 24 continuous dims = layer-groups (3) x anchors (8) mixing coefficients in [0,1].
- Objective mimics a k-fold CV NLL surface: a smooth bowl around an unknown
  optimum plus mild coupling + small noise (each eval is "expensive", so budget
  is small). Lower is better.

Compares Random / TPE / GP(BoTorch) samplers on a small eval budget to confirm
which backend to lock for the real merge->forward->NLL loop.
"""
import numpy as np
import optuna
from optuna.samplers import RandomSampler, TPESampler, GPSampler

optuna.logging.set_verbosity(optuna.logging.WARNING)

D = 24
rng = np.random.default_rng(0)
x_star = rng.uniform(0.2, 0.8, size=D)          # hidden optimal coefficients
A = rng.normal(0, 0.3, size=(D, D))
Q = A @ A.T / D + np.eye(D) * 0.5                # mild anisotropic coupling

def objective(trial):
    x = np.array([trial.suggest_float(f"c{i}", 0.0, 1.0) for i in range(D)])
    d = x - x_star
    val = float(d @ Q @ d)                        # smooth bowl, min 0 at x_star
    val += rng.normal(0, 0.01)                     # small eval noise
    return val

BUDGET = 45
results = {}
for name, sampler in [
    ("random", RandomSampler(seed=1)),
    ("tpe",    TPESampler(seed=1, n_startup_trials=10)),
    ("gp",     GPSampler(seed=1, n_startup_trials=10)),
]:
    study = optuna.create_study(direction="minimize", sampler=sampler)
    study.optimize(objective, n_trials=BUDGET, show_progress_bar=False)
    results[name] = study.best_value
    print(f"{name:7s} best={study.best_value:.4f}  (after {BUDGET} evals)")

print("\nlower is better; gp should reach the smallest NLL-proxy on this budget")

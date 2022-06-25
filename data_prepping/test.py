import json
import os
import re


repl_chars = "(名)"
for repl_char in repl_chars:
    a = a.replace(repl_char, ",")

print(a.split(","))
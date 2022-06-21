import json
import os
import re


a = "自由民主党・国民の声(110名)"

repl_chars = "(名)"
for repl_char in repl_chars:
    a = a.replace(repl_char, ",")

print(a.split(","))
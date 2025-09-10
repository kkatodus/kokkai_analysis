#!/usr/bin/env python3
# Simulate the exact code from the notebook
import os
import re
import json

ROOT_DIR = './data_prepping'
DATA_DIR = os.path.join(ROOT_DIR, 'data')
MANIFESTO_DIR = os.path.join(DATA_DIR, 'data_manifesto')
CURRENT_ELECTION_DIR = os.path.join(MANIFESTO_DIR, '2025UpperHouseElection')

# The exact regex from the notebook
policy_pattern = re.compile(r"""
    ^\s*TOPIC:\s*(?P<topic>[^\r\n]+)\r?\n
    ^\s*TOPIC_EN:\s*(?P<topic_en>[^\r\n]+)\r?\n
    ^\s*ASSIGNED_TOPIC_TAG:\s*(?P<assigned_tag>[^\r\n]+)\r?\n
    ^\s*MANIFESTO_TEXT:\s*(?P<text>[^\r\n]+)\r?\n
    ^\s*MANIFESTO_SUMMARY:\s*(?P<summary>[^\r\n]+)\r?\n
    ^\s*SOURCE_URL:\s*(?P<urls>[^\r\n]+)
""", re.MULTILINE | re.VERBOSE)

# Read the manifesto
party_name = '日本共産党'
manifesto_file = os.path.join(CURRENT_ELECTION_DIR, party_name, 'manifesto_5.txt')
with open(manifesto_file, 'r', encoding='utf-8') as f:
    manifesto = f.read()

# Process it
policies_in_file = [m.groupdict() for m in policy_pattern.finditer(manifesto)]
expected_num_policies = manifesto.count('TOPIC:')

print(f'Party: {party_name}')
print(f'Expected: {expected_num_policies}')
print(f'Found: {len(policies_in_file)}')

if len(policies_in_file) != expected_num_policies:
    print(f'WARNING: {party_name} has {len(policies_in_file)} policies, but expected {expected_num_policies}')
else:
    print('SUCCESS: All policies found!')

# Let's see what's happening in detail
print("\nFirst few policies found:")
for i, policy in enumerate(policies_in_file[:3]):
    print(f"\nPolicy {i+1}:")
    for key, value in policy.items():
        print(f"  {key}: {value[:50]}..." if len(value) > 50 else f"  {key}: {value}")
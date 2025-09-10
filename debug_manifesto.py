#!/usr/bin/env python
# coding: utf-8

import re

# The regex pattern from the original script
policy_pattern = re.compile(r"""
    ^\s*TOPIC:\s*(?P<topic>[^\r\n]+)\r?\n
    ^\s*TOPIC_EN:\s*(?P<topic_en>[^\r\n]+)\r?\n
    ^\s*ASSIGNED_TOPIC_TAG:\s*(?P<assigned_tag>[^\r\n]+)\r?\n
    ^\s*MANIFESTO_TEXT:\s*(?P<text>[^\r\n]+)\r?\n
    ^\s*MANIFESTO_SUMMARY:\s*(?P<summary>[^\r\n]+)\r?\n
    ^\s*SOURCE_URL:\s*(?P<urls>[^\r\n]+)
""", re.MULTILINE | re.VERBOSE)

# Read the manifesto file
with open('/root/projects/kokkai_analysis/data_prepping/data/data_manifesto/2025UpperHouseElection/日本共産党/manifesto_5.txt', 'r', encoding='utf-8') as f:
    manifesto_content = f.read()

# Find all matches
policies = [m.groupdict() for m in policy_pattern.finditer(manifesto_content)]

print(f"Total TOPIC: occurrences: {manifesto_content.count('TOPIC:')}")
print(f"Policies found by regex: {len(policies)}")

print("\nPolicies found:")
for i, policy in enumerate(policies):
    print(f"{i+1}. {policy['topic']}")

# Let's check which TOPICs are not matched
all_topics = []
for line in manifesto_content.split('\n'):
    if line.strip().startswith('TOPIC:') and not line.strip().startswith('TOPIC_EN:'):
        topic_text = line.strip()[6:].strip()
        all_topics.append(topic_text)

print(f"\nAll TOPICs found: {len(all_topics)}")
for i, topic in enumerate(all_topics):
    print(f"{i+1}. {topic}")

# Find which topics are missing
matched_topics = [p['topic'] for p in policies]
missing_topics = [t for t in all_topics if t not in matched_topics]

print(f"\nMissing topics ({len(missing_topics)}):")
for topic in missing_topics:
    print(f"- {topic}")
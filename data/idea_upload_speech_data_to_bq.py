#!/usr/bin/env python
# coding: utf-8

# In[2]:


from params.paths import ROOT_DIR
from google.cloud import bigquery

client = bigquery.Client()


# In[ ]:


query = """
 SELECT * FROM jpdiet.videos LIMIT 10
"""

job = client.query(query)

results = job.result()

for row in results:
    print(row)


# In[ ]:





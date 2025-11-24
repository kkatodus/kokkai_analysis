#!/usr/bin/env python
# coding: utf-8

# In[ ]:


from dotenv import load_dotenv
import os


from api_requests.prompter import DeepResearchGemini
from dbio.representative_db import connect_db, create_tables_if_not_exist, Person, ElectionResult, iterate_all_persons, get_election_result_by_person_id, insert_x_account

prompter = DeepResearchGemini()


x_account_collection_sys_prompt = """\\
You are a research assistant that helps users find X account information of politicians. I am going to provide you with the name and election details of a politician, and you will search for their X account. If you find it, please provide the account handle (e.g., @example). If you cannot find the account, please respond with "Not found". Make sure to only provide the account handle or "Not found" as your response. Do not include any additional information or explanations.
    
    """

x_account_collection_prompt = lambda name_kanji, election_details: f"""\\
Here is the politician's information:
Name: \n{name_kanji}\n\n
Election Details: \n{election_details}
Please find their X account.
"""
load_dotenv()



conn = connect_db(
    dbname="kokkaidoc",
    user="postgres",
    password=os.getenv("PSQL_DATABASE_PASSWORD"),
    host="localhost",
    port=5432,
)

with conn.cursor() as cur:
    create_tables_if_not_exist(cur)
    latest_person_id = None
    
    cur.execute("SELECT MAX(person_id) FROM x_account;")
    row = cur.fetchone()
    if row is not None and row[0] is not None:
        latest_person_id = row[0]
        print(f"Latest person_id in person_x_account: {latest_person_id}")

    for person in iterate_all_persons(cur):
        if latest_person_id is not None and person.person_id <= latest_person_id:
            continue  # Skip already processed persons
        election_result = get_election_result_by_person_id(cur, person.person_id)
        last_election_year = max([e.election_date.year for e in election_result]) if election_result else None
        if last_election_year is None or last_election_year < 2000:
            continue  # Skip if no elections or last election before 2000
        print(last_election_year, person.name_kanji)
        election_result_str = "\n".join([str(er) for er in election_result])
        prompt = x_account_collection_prompt(person.name_kanji, election_result_str)
        resp, _, _ = prompter.prompt(prompt=prompt, system_prompt=x_account_collection_sys_prompt)
        
        if resp.strip() != "Not found":
            x_account = resp.strip()
        else:
            x_account = ""
        count = 0
        while True:
            try:
                insert_x_account(cur, person.person_id, x_account)
                conn.commit()
                break
                
            except Exception as e:
                print(f"Error inserting x_account for person_id {person.person_id}: {e}")
                conn.rollback()
                count += 1
                if count >= 1:
                    print("Failed to insert after retrying. Skipping to next person.")
                    break

        print(person)


# In[ ]:





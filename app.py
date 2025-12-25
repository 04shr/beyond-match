import requests

url = "https://jsearch.p.rapidapi.com/search"

querystring = {
    "query": "data analyst jobs in uk",
    "page": "1",
    "num_pages": "1"
}

headers = {
    "x-rapidapi-key": "4473354741msh1a226b5b22fe3d7p1270b2jsnec7a193cc326",
    "x-rapidapi-host": "jsearch.p.rapidapi.com"
}

response = requests.get(url, headers=headers, params=querystring)

print("Status:", response.status_code)
print("Raw Response:\n", response.text)

# Parse JSON (optional)
data = response.json()

print("\n---- SAMPLE FIELDS ----\n")
for job in data.get("data", [])[:3]:
    print("Job Title:", job.get("job_title"))
    print("Company:", job.get("employer_name"))
    print("Location:", job.get("job_city"), job.get("job_country"))
    print("Salary:", job.get("job_salary"))
    print("Posted:", job.get("job_posted_at"))
    print("Description:", job.get("job_description")[:120], "...")
    print("-" * 30)

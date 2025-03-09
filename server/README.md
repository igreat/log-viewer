## Setup

Run the following commands to setup the project:

`python3 -m venv venv`

`source venv/bin/activate`

`pip install -r requirements.txt`

Then, to run the server:

`python3 main.py`

How to use the database

1. First install elasticsearch from `https://www.elastic.co/guide/en/elasticsearch/reference/current/install-elasticsearch.html`. 
2. Navigate to the location where elastic search is installed and enter that directory (called elasticsearch-8.17.3). Execute this command
    `./bin/elasticsearch`
3. Activate the VM following the steps above and run the server
4. Check that the elasticsearch instance is setup properly by executing `curl -X GET "http://localhost:9200/"`
# Log Viewer Tool

A modern log viewer tool designed for Cisco engineers to quickly view, filter, and analyze log files. The tool features a responsive UI, customizable filters, intelligent summarization and issue detection powered by AI agents, and workspace management.

## Table of Contents

- [Overview](#overview)
- [Setup](#setup)
  - [Client Setup](#client-setup)
  - [Server Setup](#server-setup)
  - [Database Setup](#database-setup)
  - [Environment Variables (.env)](#environment-variables-env)
- [Features](#features)
  - [Uploading and Viewing Log Files](#uploading-and-viewing-log-files)
  - [Filtering Log Entries](#filtering-log-entries)
    - [Basic Search Bar](#basic-search-bar)
    - [Predefined Filters](#predefined-filters)
    - [Custom Filters](#custom-filters)
  - [AI Agent for Analysis](#ai-agent-for-analysis)
    - [Summary Generation](#summary-generation)
    - [Known Issues Detection](#known-issues-detection)
    - [Filter Recommendation](#filter-recommendation)
  - [Workspaces & Categories](#workspaces--categories)
- [Future Improvements](#future-improvements)

## Overview

The Log Viewer Tool is built to help engineers quickly identify issues in large log files by:

- Uploading and displaying logs in a responsive table format.
- Providing real‑time filtering using basic text search, regex, and predefined or custom filter groups.
- Enabling an AI agent to analyze logs, generate summaries, detect known issues, and suggest filtering options.
- Organizing issues and filters into workspaces for better categorization and management.

## Setup

> **⚠️ Warning:**  
> The setup instructions provided below are currently tested only on macOS.  
> Windows and Linux support will be evaluated and documented in future updates.

### Client Setup

1. Clone the repository.
2. Navigate to the client directory.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the development server:

    ```bash
    npm run dev
    ```

### Server Setup

First navigate to the server directory:

1. Create a Python virtual environment:

    ```bash
    python3 -m venv venv
    ```

2. Activate the virtual environment:

    ```bash
    source venv/bin/activate
    ```

3. Install required packages:

    ```bash
    pip install -r requirements.txt
    ```

4. Run the server:

    ```bash
    python3 main.py
    ```

### Database Setup

For efficient log storage and search capabilities, we use Elasticsearch:

1. Install Elasticsearch by following the instructions at:
2. Elasticsearch Installation Guide
3. Navigate to your Elasticsearch installation directory (e.g. elasticsearch-8.17.3) and start Elasticsearch:

    ```bash
    ./bin/elasticsearch
    ```

4. Verify Elasticsearch is running:

    ```bash
    curl -X GET "http://localhost:9200/"
    ```

### Environment Variables (.env)

Create a .env file in the server root directory with the following keys (adjust values as needed):

```bash
OPENAI_API_KEY=your_openai_api_key_here
ELASTICSEARCH_URL=http://localhost:9200
```

## Features

### Uploading and Viewing Log Files

- **Upload:**  
  Use the "Upload" button to load a JSON log file. The logs will be rendered in a table.
  
- **View:**  
  Logs are displayed in a responsive table that allows scrolling and pagination.

### Filtering Log Entries

#### Basic Search Bar

- **Real-Time Filtering:**  
  Filter log entries as you type. Options for case sensitivity and regex are available.

#### Predefined Filters

- **Quick Isolation:**  
  Choose from a set of predefined filter groups to quickly isolate log entries. Multiple groups can be applied simultaneously.

#### Custom Filters

- **Create and Save:**  
  Click the "+" button to create custom filter groups. These filters can be saved for later use and appear in the dropdown.

### AI Agent for Analysis

The integrated AI agent assists in log analysis by generating summaries, detecting known issues, and suggesting filters.

#### Summary Generation

- **Automated Summaries:**  
  The agent analyzes log statistics and generates a concise summary to highlight trends and anomalies.

#### Known Issues Detection

- **Contextual Analysis:**  
  The agent compares log data against known issues and flags potential problems, providing an explanation and suggested resolution.

#### Filter Recommendation

- **Natural Language Conversion:**  
  The agent converts natural language queries into structured filter groups (with keywords or regex) to refine log output.

### Workspaces & Categories

- **Workspace Management:**  
  Organize filters and known issues into workspaces for better management.
  
- **Category Modal:**  
  View, edit, and delete filter categories in a modern, responsive modal interface.

### Pagination UI

- **Modern Navigation:**  
  The log tables feature modern pagination with circular navigation buttons using Material Icons, a minimal input field for page numbers, and smooth transitions.

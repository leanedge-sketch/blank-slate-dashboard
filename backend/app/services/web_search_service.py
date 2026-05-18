"""
Web Search Service - Google PSE, SerpAPI, and LinkedIn Search
==============================================================

This module handles web search functionality for customer profile generation:
- Google Programmable Search Engine (PSE) for company information
- SerpAPI for additional search results
- LinkedIn profile search for decision-makers
"""

import os
import urllib.parse
from typing import List, Dict, Optional
import requests
from bs4 import BeautifulSoup

try:
    from serpapi import GoogleSearch
except ImportError:
    GoogleSearch = None

from app.config import settings


def search_web_for_company(company_name: str) -> str:
    """
    Search the web for company information using both Google PSE, SerpAPI, 
    and force-include Wikipedia and official site.
    
    Returns formatted string with search results.
    """
    try:
        combined_results = []
        
        # 1. Google PSE Search
        pse_api_key = settings.GOOGLE_PSE_API_KEY or os.getenv("GOOGLE_PSE_API_KEY")
        pse_cx = settings.GOOGLE_PSE_CX or os.getenv("GOOGLE_PSE_CX")
        
        if pse_api_key and pse_cx:
            query = f"{company_name} company information business profile"
            encoded_query = urllib.parse.quote(query)
            url = f"https://www.googleapis.com/customsearch/v1?key={pse_api_key}&cx={pse_cx}&q={encoded_query}&num=5"
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                results = response.json()
                if "items" in results:
                    for item in results["items"]:
                        result = {
                            'title': item.get('title', ''),
                            'snippet': item.get('snippet', ''),
                            'link': item.get('link', ''),
                            'source': 'Google PSE'
                        }
                        if 'pagemap' in item and 'metatags' in item['pagemap']:
                            metatags = item['pagemap']['metatags'][0]
                            if 'og:description' in metatags:
                                result['description'] = metatags['og:description']
                        combined_results.append(result)
        
        # 2. SerpAPI Search
        serpapi_key = settings.SERPAPI_API_KEY or os.getenv("SERPAPI_API_KEY")
        if serpapi_key and GoogleSearch:
            params = {
                "engine": "google",
                "q": f"{company_name} company information business profile",
                "api_key": serpapi_key,
                "num": 5
            }
            search = GoogleSearch(params)
            results = search.get_dict()
            if "organic_results" in results:
                for result in results["organic_results"]:
                    combined_results.append({
                        'title': result.get('title', ''),
                        'snippet': result.get('snippet', ''),
                        'link': result.get('link', ''),
                        'source': 'SerpAPI'
                    })
        
        # 3. Force-include Wikipedia page
        wiki_url = f"https://en.wikipedia.org/wiki/{company_name.replace(' ', '_')}"
        try:
            wiki_resp = requests.get(wiki_url, timeout=5)
            if wiki_resp.status_code == 200:
                soup = BeautifulSoup(wiki_resp.text, 'html.parser')
                p = soup.find('p')
                snippet = p.text.strip() if p else ''
                combined_results.append({
                    'title': f"Wikipedia: {company_name}",
                    'snippet': snippet,
                    'link': wiki_url,
                    'source': 'Wikipedia'
                })
        except Exception:
            pass
        
        # 4. Force-include official site if pattern matches
        for domain in [
            f"https://{company_name.replace(' ', '').lower()}.com",
            f"https://{company_name.replace(' ', '').capitalize()}.com"
        ]:
            try:
                resp = requests.get(domain, timeout=3)
                if resp.status_code == 200:
                    combined_results.append({
                        'title': f"Official Site: {company_name}",
                        'snippet': f"Official website for {company_name}.",
                        'link': domain,
                        'source': 'Official Site'
                    })
                    break
            except Exception:
                continue
        
        # Remove duplicates based on URL
        unique_results = []
        seen_urls = set()
        for result in combined_results:
            if result['link'] not in seen_urls:
                seen_urls.add(result['link'])
                unique_results.append(result)
        
        # Format results
        web_context = ""
        for result in unique_results:
            web_context += f"\nTitle: {result['title']}\n"
            web_context += f"Snippet: {result['snippet']}\n"
            web_context += f"Link: {result['link']}\n"
            web_context += f"Source: {result['source']}\n"
            if 'description' in result:
                web_context += f"Description: {result['description']}\n"
            web_context += "---\n"
        return web_context
    except Exception as e:
        return f"Web search failed: {str(e)}\n"


def search_linkedin_profiles_ethiopia(company_name: str) -> str:
    """
    Search for LinkedIn profiles in Ethiopia using both Google PSE and SerpAPI.
    
    Returns formatted string with LinkedIn profile information.
    """
    try:
        all_profiles = []
        
        # Broader search query as a fallback
        search_queries = [
            f'site:linkedin.com/in/ "{company_name}" Ethiopia (CEO OR "Managing Director" OR "General Manager")',
            f'site:linkedin.com/in/ "{company_name}" Ethiopia (Operations OR "Plant Manager" OR Production)',
            f'site:linkedin.com/in/ "{company_name}" Ethiopia (Procurement OR "Supply Chain" OR Purchasing)',
            f'site:linkedin.com/in/ "{company_name}" Ethiopia (Technical OR R&D OR Quality)',
            f'site:linkedin.com/in/ "{company_name}" Ethiopia (Sales OR "Business Development")',
            f'site:linkedin.com/in/ "{company_name}" Ethiopia'  # General search
        ]
        
        # Check for API keys
        pse_api_key = settings.GOOGLE_PSE_API_KEY or os.getenv("GOOGLE_PSE_API_KEY")
        pse_cx = settings.GOOGLE_PSE_CX or os.getenv("GOOGLE_PSE_CX")
        serpapi_key = settings.SERPAPI_API_KEY or os.getenv("SERPAPI_API_KEY")
        
        # 1. Google PSE Search
        if pse_api_key and pse_cx:
            for query in search_queries:
                try:
                    encoded_query = urllib.parse.quote(query)
                    url = f"https://www.googleapis.com/customsearch/v1?key={pse_api_key}&cx={pse_cx}&q={encoded_query}&num=5&gl=et&hl=en"
                    response = requests.get(url, timeout=10)
                    if response.status_code == 200:
                        results = response.json()
                        if "items" in results:
                            for item in results["items"]:
                                title = item.get('title', '')
                                snippet = item.get('snippet', '')
                                link = item.get('link', '')
                                
                                name = title.split('|')[0].strip()
                                position = snippet.split('·')[0].strip() if '·' in snippet else 'Not specified'
                                
                                all_profiles.append({
                                    'name': name,
                                    'position': position,
                                    'link': link,
                                    'snippet': snippet,
                                    'source': 'Google PSE'
                                })
                except Exception:
                    continue
        
        # 2. SerpAPI Search
        if serpapi_key and GoogleSearch:
            for query in search_queries:
                try:
                    params = {
                        "engine": "google",
                        "q": query,
                        "api_key": serpapi_key,
                        "num": 5,
                        "gl": "et",
                        "hl": "en",
                        "filter": 0
                    }
                    search = GoogleSearch(params)
                    results = search.get_dict()
                    
                    if "organic_results" in results:
                        for result in results["organic_results"]:
                            title = result.get('title', '')
                            snippet = result.get('snippet', '')
                            link = result.get('link', '')
                            
                            name = title.split('|')[0].strip()
                            position = snippet.split('·')[0].strip() if '·' in snippet else 'Not specified'
                            
                            all_profiles.append({
                                'name': name,
                                'position': position,
                                'link': link,
                                'snippet': snippet,
                                'source': 'SerpAPI'
                            })
                except Exception:
                    continue
        
        # Remove duplicates based on LinkedIn URL and format results
        unique_profiles = []
        seen_links = set()
        for profile in all_profiles:
            if profile['link'] and profile['link'] not in seen_links:
                seen_links.add(profile['link'])
                unique_profiles.append(profile)
        
        linkedin_context = "\nLinkedIn Profiles in Ethiopia:\n"
        if unique_profiles:
            for profile in unique_profiles[:10]:  # Limit to top 10 profiles
                linkedin_context += f"\n- Name: {profile['name']}\n"
                linkedin_context += f"  Position: {profile['position']}\n"
                linkedin_context += f"  Profile: {profile['link']}\n"
                linkedin_context += f"  Source: {profile['source']}\n"
                if profile['snippet']:
                    context = profile['snippet'].split('·')[-1].strip()
                    if context:
                        linkedin_context += f"  Context: {context}\n"
                linkedin_context += "---\n"
        else:
            linkedin_context += "\nNo relevant LinkedIn profiles found. This could be due to missing API keys, search limitations, or no public profiles for this company.\n"
        
        return linkedin_context
    except Exception as e:
        return f"\nLinkedIn Profiles in Ethiopia:\nSearch Error: {str(e)}\n"


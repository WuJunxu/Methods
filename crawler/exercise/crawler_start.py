# import urllib
# from urllib.request import Request
import requests

search = '王者荣耀'
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.75 Safari/537.36'
}
url = 'https://sogou.com/web?query=%s'%(search)
response = requests.get(url=url, headers=headers)
page_text = response.text

with open('H:/github/Methods/crawler/sogou.html','w',encoding='utf-8') as f:
    f.write(page_text)
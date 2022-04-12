import requests
import json

url = 'https://movie.douban.com/j/chart/top_list'
param = {
    'type': '24',
    'interval_id': '100:90',
    'action': '',
    'start': '0',
    'limit': '20',
}

header = {
       'User-Agent':'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Safari/537.36 Core/1.70.3775.400 QQBrowser/10.6.4208.400'
    }

response = requests.get(url=url, params=param, headers=header)
list_data = response.json()

with open('./Methods/crawler/douban.json','w',encoding='utf-8') as f:
    json.dump(list_data, fp=f, ensure_ascii=False)


import requests


# location_name = '北京北京市东城区北京市东城区东直门内大街277号楼6A'
# url = 'http://api.map.baidu.com/geocoder?address=%s&output=html'%(location_name)

url = 'https://www.alittle-tea.com/storelocations/1/1/1/6/'

header = {
       'User-Agent':'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Safari/537.36 Core/1.70.3775.400 QQBrowser/10.6.4208.400'
    }

response = requests.get(url=url, headers=header)

text_data = response.text

with open('./Methods/crawler/一点点.txt','w',encoding='utf-8') as f:
    f.write(text_data)

print(text_data)
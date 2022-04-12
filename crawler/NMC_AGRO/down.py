import requests
import os
import time
import random

import sys
module_path = os.path.abspath(os.path.join(".."))
if module_path not in sys.path:
    sys.path.append(module_path)

from user_agent import get_agent


def download(date, crop, out_dir):

    crop_key, crop_name = crop

    date_1 = ''.join(date.split('/'))
    url = 'http://image.nmc.cn/product/%s/CGRM/SEVP_NMC_CGRM_SFER_%s_ACHN_L88_P9_%s000000000.jpg'%(date, crop_key, date_1)

    header = {
        'User-Agent': get_agent()
    }
    response = requests.get(url=url, headers=header)
    img_data = response.content

    fn = os.path.join(out_dir,crop_name,''.join([crop_name,'_',date_1,'.jpg']))
    with open(fn,'wb') as f:
        f.write(img_data)
    
    print(fn)

crop_type = {
    'EYC1': 'Canola', 'EXM3': 'Wheat',
    'EXM2': 'SpringWheat', 'EMLS1': 'Potato',
    'EHS1': 'Peanut', 'ESD2': 'DoubleSeasonEarlyRice',
    'EYM2': 'SpringMaize', 'ESD4': 'OneSeasonRice'
}

date = '2022/04/11'
out_dir = r'H:\github\Methods\Phenology\NMC_AGRO'


for crop in crop_type.items():
    download(date, crop, out_dir)
    time.sleep(1 + random.random())
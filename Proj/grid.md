## 椭球体
### 椭球体参数
- 长半轴a，近似等于地球赤道半径
- 短半轴b，近似等于南极或北极到赤道面的距离
- 扁率$\alpha$，$\alpha=\frac{a-b}{a}$
- 第一偏心率e，$e=\frac{\sqrt{a^2-b^2}}{a}$
- 第二偏心率e'，$e=\frac{\sqrt{a^2-b^2}}{b}$

### 我国参考椭球
- 1952年，海福特椭球(1924年国际椭球)
- 1953年，克拉索夫斯基(Krassovsky)椭球，北京54坐标系
- 1978年，1975地球椭球，西安80坐标系
- 2000年，CGCS2000椭球，2000年国家大地坐标系




## WGS84
a = 6378137
b = 6356752.314245

### lon
1$\degree$ == 2$\pi$b/360 m == 110.94625761655934 km

### lat
1$\degree$ == 2$\pi$acos$\phi$/360 m

$\phi$=30$\degree$, 1$\degree$ == 96.40267902697512 km


```python

def CreateGrid(src_shp, tar_shp, grid_size):
    minLon, minLat, maxLon, maxLat = src_shp.bbox
    phi = (minLat+maxLat)/2

    oneDegreeLon = (2*math.pi*b/360)
    oneDegreeLat = (2*math.pi*a*cos(phi)/360)

    lonSpacing = grid_size/oneDegreeLon
    latSpacing = grid_size/oneDegreeLat

    pass


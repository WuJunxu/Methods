
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


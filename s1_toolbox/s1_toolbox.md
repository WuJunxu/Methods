> [1 Border Noise Correction](#1-border-noise-correction)

> [2 Incident Angle Correction](#2-incident-angle-correction)

> [3 Speckle Filter](#3-speckle-filter)
  >> [3.1 mono-temporal](#31-mono-temporal)\
  >> [3.2 multi-temporal](#32-multi-temporal)

> [4 Terrain Correction](#4-terrain-correction)

- toDB
- to?
- CR Calculation

## 1 Border Noise Correction

  - 设置入射角阈值范围裁剪无效边界
  - Sentinel-1 GRD影像存在因处理而产生的边界噪声，2018年3月之前的影像都受到了这种特殊噪声的影响，[基于形态学去除边界噪声](http://dx.doi.org/10.3390/s18103454)，[基于入射角阈值去除边界噪声](https://doi.org/10.3390/rs13101954)。


## 2 Incident Angle Correction


## 3 Speckle Filter

### 3.1 mono-temporal
#### Boxcar
#### Lee filter
#### Gamma Maximum A-posterior (MAP) Filter
#### Refined Lee filter
#### the improved Lee sigma filter


### 3.2 multi-temporal


## 4 Terrain Correction


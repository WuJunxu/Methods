from numpy import size
from osgeo import gdal
import matplotlib.pyplot as plt

fn = r'C:\Users\WJX15\Desktop\GF2.tif'

ds = gdal.Open(fn)
image = ds.ReadAsArray()
print(image.shape)


N = image[3,:,:].flatten()
R = image[2,:,:].flatten()
G = image[1,:,:].flatten()
B = image[0,:,:].flatten()

fig, ax = plt.subplots(1,2, figsize=(12,6))


ax[0].scatter(R,N,s=1,color='k',marker='d',alpha=0.8)
ax[0].set_xlabel('R$_{TOA}$', fontsize=18)
ax[0].set_ylabel('NIR$_{TOA}$', fontsize=18)
ax[0].set_title('NIR/R Relationship', fontsize=20)
ax[0].set_xlim(0,1000)
ax[0].set_ylim(0,1000)

ax[1].scatter(B,G,s=1,color='k',marker='d',alpha=0.8)
ax[1].set_xlabel('B$_{TOA}$', fontsize=18)
ax[1].set_ylabel('G$_{TOA}$', fontsize=18)
ax[1].set_title('G/B Relationship', fontsize=20)
ax[1].set_xlim(0,1000)
ax[1].set_ylim(0,1000)


plt.savefig('NIR-R.jpg', dpi=300, bbox_inches='tight')
# plt.show()

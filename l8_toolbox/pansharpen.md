```JavaScript
// Load a Landsat 8 top-of-atmosphere reflectance image.
image = ee.Image('LANDSAT/LC08/C01/T1_TOA/LC08_044034_20140318')

// Convert the RGB bands to the HSV color space.
hsv = image.select(['B4', 'B3', 'B2']).rgbToHsv()

// Swap in the panchromatic band and convert back to RGB.
sharpened = ee.Image.cat([
  hsv.select('hue'), hsv.select('saturation'), image.select('B8')
]).hsvToRgb()
```
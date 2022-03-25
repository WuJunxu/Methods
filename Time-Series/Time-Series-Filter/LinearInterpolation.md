https://gis.stackexchange.com/questions/323728/smoothing-interpolating-across-images-in-an-imagecollection-to-remove-missing-da



## Filters
### ee.Filter.maxDifference
> Creates a unary or binary filter that passes if the left and right operands, both numbers, are within a given maximum difference. If used as a join condition, this numeric difference is used as a join measure.
```Javascript
ee.Filter.maxDifference(difference, leftField, rightValue, rightField, leftValue)

ee.Filter.maxDifference(1000*3600*24*day, 'system:time_start', null, 'system:time_start')
```
选取时间与起始影像差值在1000*3600*24*day内的影像，如day=15，即起始影像前后15天的滑动窗口，滑动窗口总大小为31天

### ee.Filter.lessThanOrEquals
> A lessThanOrEquals filter to find all images after a given image. This will compare the given image’s timestamp against other images’ timestamps

### ee.Filter.greaterThanOrEquals
> A greaterThanOrEquals filter to find all images before a given image. This will compare the given image’s timestamp against other images’ timestamps

### ee.Join.saveAll
> ee.Join.saveAll(matchesKey, ordering, ascending, measureKey, outer)

### ee.Join.apply
> ee.Join.apply(primary, secondary, condition)

## Principle of LinearInterpolation
![linearInterpolated](https://th.bing.com/th/id/OIP.IZEBL41TGNsM3F0tsLPYkwAAAA?pid=ImgDet&rs=1)

## Implementation

### Mosaic By Time
```JavaScript
var addDate = function(image){
   var date = image.date().format('YYYYMMdd');
   return image.set('date', ee.Number.parse(date));
};
```

```JavaScript
var mosaicByTime = function(images) {
  var TIME_FIELD = 'date'; //system:index

  var distinct = images.distinct([TIME_FIELD]);

  var filter = ee.Filter.equals({ leftField: TIME_FIELD, rightField: TIME_FIELD });
  var join = ee.Join.saveAll('matches');
  var results = join.apply(distinct, images, filter);

  // mosaic
  results = results.map(function(i) {
    var mosaic = ee.ImageCollection.fromImages(i.get('matches')).sort('date').max().set('system:time_start',i.get('system:time_start')); //system:index
    
    return mosaic.copyProperties(i).set(TIME_FIELD, i.get(TIME_FIELD));
  });
  
  return ee.ImageCollection(results);
};
```

### Create Empty ImageCollection By Equal Time Interval
```JavaScript
function makeImgsWithDates(date,mask){
  date = ee.Date(date)
  var img = ee.Image()
    .updateMask(mask)
    .set('system:time_start', date.millis())
    .rename('timestamp')
  return img
}

// Make EmptyCollection with A Geometry Mask
var makeEmptyCollection = function(mask, date_start, date_end, step){
  step = step || 10
  date_start = ee.Date(date_start)
  date_end = ee.Date(date_end)
  var days = ee.List.sequence(0, date_end.difference(date_start, 'day'), step)
      .map(function(d){return date_start.advance(d, 'day')})
  var emptyCollection = ee.ImageCollection(days.map(function(d){return makeImgsWithDates(d, mask)}))
  return emptyCollection
}

```


### addTimeBand
```JavaScript
var addTimeBand = function(image) {
  var timeImage = image.metadata('system:time_start').rename('timestamp')
  var timeImageMasked = timeImage.updateMask(image.mask().select(0))
  return image.addBands(timeImageMasked)
}
```

### Join before and after images
```JavaScript
// Join EmptyCollection with Target ImageCollection
var joinBeforeAndAfter = function(emptyCol, imgCol, frame){
  var imgcol = imgCol.map(addTimeBand)

  var frame = frame || 30
  var time = 'system:time_start';
  var maxDiff = ee.Filter.maxDifference(frame * (1000*60*60*24), time, null, time);
  var condition = {leftField:time, rightField:time}

  var lessEqFilter = ee.Filter.lessThanOrEquals(condition) // After Images Filter
  var greaterEqFilter = ee.Filter.greaterThanOrEquals(condition) // Before Images Filter
  var afterFilter = ee.Filter.and(maxDiff, lessEqFilter)
  var beforeFilter = ee.Filter.and(maxDiff, greaterEqFilter)

  var c1 = ee.Join.saveAll({matchesKey:'after', ordering:time, ascending:false})
    .apply(emptyCol, imgcol, afterFilter);

  var c2 = ee.Join.saveAll({matchesKey:'before', ordering:time, ascending:true})
    .apply(c1, imgcol, beforeFilter);
  
  return c2
}
```

### Linear interpolation and replace masked pixels

```JavaScript
var interpolate = function(img){
    var img = ee.Image(img)
    var before = ee.ImageCollection.fromImages(ee.List(img.get('before'))).mosaic()
    var after = ee.ImageCollection.fromImages(ee.List(img.get('after'))).mosaic()
    
    var t1 = before.select('timestamp')
    var t2 = after.select('timestamp')
    var t = img.metadata('system:time_start')

    var ratio = t.subtract(t1).divide(t2.subtract(t1))

    var interpolated = before.add(after.subtract(before).multiply(ratio))
    var result = img.unmask(interpolated)
    return result.copyProperties(img,['system:time_start'])
}

```

### Main
```JavaScript
var linearInterpolation = function(imgCol, geometry, date_start, date_end, frame, step){
  
  var mask = ee.Image.constant(1).clip(geometry)
  
  // Mosaic By The Same Time
  imgCol = imgCol.map(addDate)
  imgCol = mosaicByTime(imgCol)
    .map(function(img){return img.updateMask(mask)})
  
  // Create Empty Collection By Equal Time Interval
  var emptyCol = makeEmptyCollection(mask,date_start,date_end,step)
  
  // Join Before and After Images, Interpolated
  var imgCol_Join = joinBeforeAndAfter(emptyCol, imgCol, frame)
  var imgCol_Interp = ee.ImageCollection(imgCol_Join.map(interpolate))
  
  return imgCol_Interp
}

```


```JavaScript
var s1tbx = require('users/bnuxjw/geetools:s1_toolbox')
var mask = ee.Image.constant(1).clip(geometry)

var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterDate('2018-09-15','2019-07-01')
  .filterBounds(geometry)
  .filter(ee.Filter.eq('platform_number','A'))
  .map(s1tbx.IncidentAngleCorrection)
  .map(s1tbx.addCR)
  .map(function(img){return img.updateMask(mask)})
  

var s1_interp = linearInterpolation(s1, geometry, '2018-10-01', '2019-06-20', 12, 10)

print(s1,'s1')
print(s1_interp,'s1_interp')

Map.addLayer(s1.select(['VV','VH','CR']),{bands:['VV','VH','CR'],min:-25,max:0},'s1')
Map.addLayer(s1_interp.select(['VV','VH','CR']),{bands:['VV','VH','CR'],min:-25,max:0},'s1_interp')
```
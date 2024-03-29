// TODO

var Product = require('../models/product');
var Brand = require('../models/brand');
var Tag = require('../models/tag');
var ProductInstance = require('../models/productInstance');

const async = require('async');
const { body, validationResult } = require("express-validator");

exports.index = function(req, res) {

  async.parallel({
    product_count: function (callback) {
      Product.countDocuments({}, callback); // Pass an empty object as match condition to find all documents of this collection
    },
    // product_instance_count: function(callback) {
    //   ProductInstance.countDocuments({}, callback);
    // },
    // product_available_count: function(callback) {
    //   Product.countDocuments({status: 'Available', callback});
    // },
    // brand_count: function(callback) {
    //   Brand.countDocuments({}, callback);
    // },
    // tag_count: function(callback) {
    //   Tag.countDocuments({}, callback);
    // }
  },
  function(err, results) {
    // After the functions above are successful, this callback function calls
    // res.render(), specifying a view (template) named 'index' and an object containing
    // the data taht is inserted into it (in this case, the count of the various models).
    console.log('done queries');
    res.render('index', { title: 'MERNCommerce', error: err, data: results});
  });
};

// Display a list of all products
exports.product_list = function(req, res) {
  Product.find({}, 'name brand')
    .populate('brand')
    .exec(function (err, list_products) {
      if (err) { return next(err); }
      // Successful, so render
      // console.log(list_products);
      res.json({ 'list_products': list_products });

      // Run this commented code for server side rendering but you have to comment out res.json(list_products) above.
      // res.render('product_list', { title: 'Product List', product_list: list_products });
      
      
    });
};

// Display detail page for a specific product
exports.product_detail = function(req, res, next) {
  
  async.parallel({
    product: function(callback) {
      Product.findById(req.params.id)
        .populate('brand')
        .populate('tag')
        .exec(callback);
    },
    
    product_count: function(callback) {
      ProductInstance.countDocuments({ 'product': req.params.id}, callback);
    },
  }, function(err, results) {
      if (err) { return next(err); }
      if (results.product==null) { // No results.
        var err = new Error('Product Not Found.');
        err.status = 404;
        return next(err);
      }

      const renderObj = {
        title: results.product.name,
        product: results.product,
        product_count: results.product_count,
      };

      // Success, so render
      res.render('product_detail', renderObj);
  });
};

// Display Product Create form on GET
exports.product_create_get = function(req, res) {

  // Get all brands and tags, which we can use for adding to our product.
  async.parallel({
    brands: function(callback) {
      Brand.find(callback);
    },

    tags: function(callback) {
      Tag.find(callback);
    },
  }, function(err, results) {
    if (err) { return next(err); }
    const renderObj = {
      title: 'Create Product',
      brands: results.brands,
      tags: results.tags,
    }
    res.render('product_form', renderObj);
  });
  
};

// Handle Product Create on POST
exports.product_create_post = [

  // Convert the tag to an array.
  (req, res, next) => {
    if(!(req.body.tag instanceof Array)) {
      if(typeof req.body.tag ==='undefined') {
        req.body.tag = [];
      } else {
        req.body.tag = new Array(req.body.tag);
      }
    }
    next();
  },
  
  // Validate and sanitize the name fields.
  body('name', 'Product name is required').trim().isLength({ min: 1 }).escape(),
  body('brand', 'Brand must not be empty').trim().isLength({ min: 1}).escape(),
  body('price', 'Price must not be empty').trim().isLength({ min: 1}).escape(),
  body('description', 'Description must not be empty').trim().isLength({ min: 1}).escape(),
  body('tag.*').escape(),

  // Process request after vaidation and sanitization.
  (req, res, next) => {

    // Extract the validation errors from a request.
    const errors = validationResult(req);

    // Create a product object with escaped and trimmed data
    var product = new Product(
      { 
        name: req.body.name,
        brand: req.body.brand,
        price:req.body.price,
        status: 'Out of Stock',
        description: req.body.description,  
        tag: req.body.tag,
      });

    if (!errors.isEmpty()) {
      // There are errors. Render form again with sanitaized values/error messages.

      // Get all brands and tags for form.
      async.parallel({
        brands: function(callback) {
          Brand.find(callback);
        },

        tags: function(callback) {
          Tag.find(callback);
        },
      }, function(err, results) {
        if (err) { return next(err); }

        // Mark our selected tags as checked
        for (let i = 0; i < results.tags.length; i++) {
          if (product.tag.indexOf(results.tags[i]._id) > -1) {
            results.tags[i].checked = 'true';
          }
        }

        const renderObj = {
          title: 'Create Product',
          brands: results.brands,
          tags: results.tags,
          product: product,
          errors: errors.array(),
        };
        
        res.render('product_form', renderObj);
      });

      return;
    } else {
      // Data from form is valid. Save new Product.
      product.save(function(err) {
        if (err) { return next(err); }
        // Successful - redirect to new product's detail page.
        res.redirect(product.url);
      });
    }
  }
];

// Display Product Delete form on GET
exports.product_delete_get = function(req, res) {

  // When we remove the product, we ahve to also delete its ProductInstances
  async.parallel({
    product: function(callback) {
      Product.findById(req.params.id).exec(callback);
    },

    productInstances: function(callback) {
      ProductInstance.find({ 'product': req.params.id }).exec(callback);
    },
  }, function(err, results) {
    if (err) { return next(err); }

    // No results.
    if (results.product==null) {
      res.redirect('/catalog/products');
    }

    const renderObj = {
      title: 'Delete Product',
      product: results.product,
      productInstances: results.productInstances,
    };

    res.render('product_delete', renderObj);
  });
};

// Handle Product Delete on POST
exports.product_delete_post = function(req, res, next) {

  async.parallel({
    product: function(callback) {
      Product.findById(req.body.productId).exec(callback);
    },

    productInstances: function(callback) {
      ProductInstance.find({ 'product': req.body.productId }).exec(callback);
    },
  }, function(err, results) {
    if (err) { return next(err); }

    // First remove ProductInstances of the Product
    ProductInstance.deleteMany({ 'product': req.body.productId}, function (err, results) {
      if (err) { return next(err); }

      // After removing instances of a product, remove the product itself
      Product.findByIdAndRemove(req.body.productId, function(err) {
        if (err) { return next(err); }

        // Success, redirect
        res.redirect('/catalog/products');
      });
    });
  });
};

// Display Product Update form on GET
exports.product_update_get = function(req, res) {
  
  // Retrieve book, brands and tags for form
  async.parallel({
    product: function(callback) {
      Product.findById(req.params.id)
        .populate('brand')
        .populate('tag')
        .exec(callback);
    },

    brands: function(callback) {
      Brand.find(callback);
    },

    tags: function(callback) {
      Tag.find(callback);
    }
  }, function(err, results) {
    if (err) { return next(err); }

    // No results
    if (results.product==null) {
      var err = new Error('Product not found');
      err.status = 404;
      return next(err);
    }

    // Success.
    // Mark our selected tags a checked
    for (var allTagsIter = 0; allTagsIter < results.tags.length; allTagsIter++) {
      for (var prodTagsIter = 0; prodTagsIter < results.product.tag.length; prodTagsIter++) {
        if (results.tags[allTagsIter]._id.toString()===results.product.tag[prodTagsIter]._id.toString()) {
          results.tags[allTagsIter].checked = 'true';
        }
      }  
    }

    const renderObj = {
      title: 'Update Product',
      brands: results.brands,
      tags: results.tags,
      product: results.product,
    };

    res.render('product_form', renderObj);
  });
};

// Handle Product Update on POST
exports.product_update_post = [
  // Convert the tags into an array
  (req, res, next) => {
    if (!(req.body.tag instanceof Array)) {
      if(typeof req.body.tag==='undefined') {
        req.body.tag=[];
      } else {
        req.body.tag = new Array(req.body.tag);
      }
    }
    next();
  },

  // Validate an sanitize fields
  body('name', 'Name must not be empty').trim().isLength({ min: 1}).escape(),
  body('brand', 'Brand must not be empty').trim().isLength({ min: 1}).escape(),
  body('price', 'Price must not be empty').trim().isLength({ min: 1}).escape(),
  body('description', 'Description must not be empty').trim().isLength({ min: 1}).escape(),
  body('tag.*').escape(),

  // Process request after validation and sanitization.
  (req, res, next) => {

    // Extract the validation errors from a request
    const errors = validationResult(req);

    // Create a Product object with escaped/trimmed data and OLD id.
    var product = new Product({
      name: req.body.name,
      brand: req.body.brand,
      description: req.body.description,
      price: req.body.price,
      tag: (typeof req.body.tag==='undefined') ? [] : req.body.tag,
      _id: req.params.id // This is required, or a new ID will be assigned!
    });

    if (!errors.isEmpty()) {
      // There are some errors. Render form again with sanitized values/error messages.

      // Get all brands and tags for form
      async.parallel({
        brands: function(callback) {
          Brand.find(callback);
        },

        tags: function(callback) {
          Tag.find(callback);
        },
      }, function(err, results) {
        if (err) { return next(err); }

        // Mark our selected tags as checked
        for (let i = 0; i < results.tags.length; i++) {
          if (product.tag.indexOf(results.tags[i]._id) > -1) {
            results.tags[i].checked = 'true';
          }
        }

        const renderObj = {
          title: 'Update Product',
          brands: results.brands,
          tags: results.tags,
          product: product,
          errors: errors.array(),
        };

        res.render('product_form', renderObj);
      });
      return;
    } else {
      // Data from form is valid. Update the record.
      Product.findByIdAndUpdate(req.params.id, product, {}, function(err, myProduct) {
        if (err) { return next(err); }
        
        // Successful - redirect to product detail page
        res.redirect(myProduct.url);
      });
    }
  }
];
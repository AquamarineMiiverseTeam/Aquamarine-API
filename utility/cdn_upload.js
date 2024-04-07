const cloudinary = require("cloudinary").v2

cloudinary.config({ 
  cloud_name: JSON.parse(process.env.ENVIRONMENT).CLOUDINARY_NAME, 
  api_key: JSON.parse(process.env.ENVIRONMENT).CLOUDINARY_API_KEY, 
  api_secret: JSON.parse(process.env.ENVIRONMENT).CLOUDINARY_API_SECRET 
});

async function uploadImage(path, folder) {
    const options = {
        unique_filename: true,
        overwrite: true,
        folder : folder
    }

    try {
        const result = await cloudinary.uploader.upload(path, options)
        return result
    } catch (error) {
        console.error(error)
    }
}

module.exports = {uploadImage}
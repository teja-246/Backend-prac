import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js"

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.refreshAccessToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }
    }
    catch (error) {
        throw new ApiError(500, "Something went wrong while generating Access and Refresh Token")
    }
}

const registerUser = asyncHandler(async (req, res) => {
    //user details
    // validations - not empty
    // pre existing user (check by username and email)
    // files exist => cloudinary
    //create user object - - create entry in db
    //remove and refresh token from response
    // check for user creation
    // return res


    const { fullName, email, username, password } = req.body
    console.log("email:", email);

    if (fullName === "") {
        throw new ApiError(400, "Fullname is required")
    }
    if (email === "") {
        throw new ApiError(400, "Email is required")
    }
    if (username === "") {
        throw new ApiError(400, "Username is required")
    }
    if (password === "") {
        throw new ApiError(400, "Password is required")
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })
    if (existedUser) {
        throw new ApiError(409, "User already exists")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }


    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    // if (!avatar) {
    //     throw new ApiError(400, "Avatar file is required")
    // } 


    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select("-password -refreshToken")

    if (!createdUser) {
        throw new ApiError(500, "User not created! Try again...")
    }

    return res.status(201).json(
        new ApiResponse(201, createdUser, "User registered successfully")
    )
})

const loginUser = asyncHandler(async (req, res) => {
    //req body --- data
    // username or email
    //find the user
    //check password
    //access refresh tokens
    //send cookies

    const { email, username, password } = req.body;

    if (!username || !email) {
        throw new ApiError(400, "Username or Email is required")
    }
    if (password === "") {
        throw new ApiError(400, "Password is required")
    }

    const user = await User.findOne({
        $or: [{ username }, { email }]
    })
    if (!user) {
        throw new ApiError(401, "User doesn't exist")
    }

    const isPasswordvalid = await user.isPasswordCorrect(password)

    if (!isPasswordvalid) {
        throw new ApiError(401, "Pasword is Incorrect")
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = User.findById(user._id).select("-password -refreshtoken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(200, {
                user: loggedInUser,
                accessToken,
                refreshToken
            }, "User logged in successfully")
        )
})


const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id,
        {
            $set: { refreshToken: undefined }
        },
        {
            new: true
        })

    const options = {
        httpOnly: true,
        secure: true
    }
    return res.statue(200)
    .clearCokie("accessToken", options)
    .clearCokie("refreshToken", options)
    .json( new ApiResponse(200, "Logged Out Successfully"))
})

export { registerUser, loginUser, logoutUser }
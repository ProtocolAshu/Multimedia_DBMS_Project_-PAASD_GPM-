// File: server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');

// Sequelize imports
const sequelize = require('./database');
const User = require('./models/User');
const Book = require('./models/Book');
const Video = require('./models/Video');
const Game = require('./models/Game');
const Article = require('./models/Article');
const Newspaper = require('./models/Newspaper');
const Music = require('./models/music');


sequelize.sync()
    .then(() => console.log('Database and tables created!'))
    .catch(err => console.error('Unable to create tables: ', err));

const app = express();
const port = 3000;

// Database connection and model synchronization
sequelize.sync()
    .then(() => console.log('Database and tables created!'))
    .catch(err => console.error('Unable to create tables: ', err));

// Middleware setup
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static file serving
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)){
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });


// Registration endpoint
app.post('/register', async (req, res) => {
    try {
        const { fullName, email, username, password, role, securityQuestion, securityAnswer } = req.body;
        
        // Check if user already exists
        const existingEmail = await User.findOne({ where: { email } });
        if (existingEmail) {
            return res.status(400).json({ error: 'Email already in use' });
        }
        
        const existingUsername = await User.findOne({ where: { username } });
        if (existingUsername) {
            return res.status(400).json({ error: 'Username already taken' });
        }
        
        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        
        // Create new user with role
        const newUser = await User.create({
            id: Date.now().toString(),
            full_name: fullName,
            email: email,
            username: username,
            password_hash: passwordHash,
            role: role || 'client', // Default to client if no role specified
            security_question: securityQuestion,
            security_answer: securityAnswer
        });
        
        // You could generate a token here for auto-login if you want
        
        res.status(201).json({ 
            message: 'User registered and logged in successfully',
            user: {
                id: newUser.id,
                name: newUser.full_name,
                username: newUser.username,
                email: newUser.email,
                role: newUser.role
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
});


// Add these dependencies at the top of server.js
const jwt = require('jsonwebtoken');
const SECRET_KEY = 'Pass'; // Replace with a secure key in production

// Login endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;

        // Find user by email or username
        const user = await User.findOne({
            where: {
                [Op.or]: [
                    { email: identifier },
                    { username: identifier }
                ]
            }
        });

        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // Compare password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // Generate JWT token with role included
        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username, 
                role: user.role || 'client' // Default to client if no role
            },
            SECRET_KEY,
            { expiresIn: '1h' } // Token expires in 1 hour
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.full_name,
                username: user.username,
                role: user.role || 'client'
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
    }
});

// Forgot Password - Step 1: Verify Email
app.post('/api/forgot-password/verify-email', async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(404).json({ success: false, error: 'Email not found' });
        }

        res.json({
            success: true,
            userId: user.id,
            securityQuestion: user.security_question
        });
    } catch (error) {
        console.error('Verify email error:', error);
        res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
    }
});

// Forgot Password - Step 2: Verify Security Answer
app.post('/api/forgot-password/verify-security', async (req, res) => {
    try {
        const { userId, securityAnswer } = req.body;

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        if (user.security_answer.toLowerCase() !== securityAnswer.toLowerCase()) {
            return res.status(401).json({ success: false, error: 'Incorrect security answer' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Verify security answer error:', error);
        res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
    }
});

// Forgot Password - Step 3: Reset Password
app.post('/api/forgot-password/reset', async (req, res) => {
    try {
        const { userId, newPassword } = req.body;

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(newPassword, saltRounds);

        await user.update({ password_hash: passwordHash });

        res.json({ success: true, message: 'Password reset successful' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
    }
});

// Add this to check session (optional, for index.html)
app.get('/check_session', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1]; // Expecting "Bearer <token>"
    if (!token) {
        return res.json({ logged_in: false });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        res.json({ 
            logged_in: true, 
            user: { 
                id: decoded.id, 
                username: decoded.username,
                role: decoded.role || 'client'
            } 
        });
    } catch (error) {
        res.json({ logged_in: false });
    }
});

// Logout endpoint (client-side handled, but added for completeness)
app.post('/logout', (req, res) => {
    // Since we're using JWT, logout is handled client-side by removing the token
    res.json({ success: true, message: 'Logged out successfully' });
});


// Use upload.fields to handle multiple file inputs
app.post('/upload-book', upload.fields([
    { name: 'bookImage', maxCount: 1 },
    { name: 'bookPdf', maxCount: 1 }
]), async (req, res) => {
    try {
        const bookData = {
            id: Date.now().toString(),
            bookName: req.body.bookName,
            authorName: req.body.authorName,
            bookImage: req.files.bookImage ? `/uploads/${req.files.bookImage[0].filename}` : '',
            bookPdf: req.files.bookPdf ? `/uploads/${req.files.bookPdf[0].filename}` : '',
            birthYear: req.body.birthYear,
            deathYear: req.body.deathYear,
            language: req.body.language,
            genre: req.body.genre,
            literaryMovement: req.body.literaryMovement,
            importantThemes: req.body.importantThemes,
            keyCharacters: req.body.keyCharacters,
            bookSummary: req.body.bookSummary,
            youtubeLink: req.body.youtubeLink,
            bookLink: req.body.bookLink || ''
        };

        // Generate HTML content
        const htmlContent = generateBookPage(bookData);

        // Ensure books directory exists
        const booksDir = path.join(__dirname, 'public', 'books');
        if (!fs.existsSync(booksDir)){
            fs.mkdirSync(booksDir);
        }

        // Generate unique filename
        const filename = `book_${bookData.id}.html`;
        const outputPath = path.join(booksDir, filename);

        // Save generated HTML
        fs.writeFileSync(outputPath, htmlContent);

        // Add HTML link to book data
        bookData.htmlLink = `/books/${filename}`;

        // Create book in database
        await Book.create(bookData);

        // Respond with HTML content
        res.send(htmlContent);
    } catch (error) {
        console.error('Error uploading book:', error);
        res.status(500).send('Error uploading book');
    }
});

// Route to get all books
app.get('/books', async (req, res) => {
    try {
        const books = await Book.findAll();
        res.json(books);
    } catch (error) {
        console.error('Error fetching books:', error);
        res.status(500).json({ error: 'Unable to fetch books' });
    }
});

// Route to get a specific book by ID
app.get('/books/:id', async (req, res) => {
    try {
        const book = await Book.findByPk(req.params.id);
        if (book) {
            res.json(book);
        } else {
            res.status(404).json({ error: 'Book not found' });
        }
    } catch (error) {
        console.error('Error fetching book:', error);
        res.status(500).json({ error: 'Unable to fetch book' });
    }
});


// Video upload route
app.post('/upload-video', upload.single('videoThumbnail'), async (req, res) => {
    try {
        const videoData = {
            id: Date.now().toString(),
            videoTitle: req.body.videoTitle,
            creator: req.body.creator,
            videoThumbnail: req.file ? `/uploads/${req.file.filename}` : '',
            videoEmbedCode: req.body.videoEmbedCode,
            genre: req.body.genre,
            releaseYear: req.body.releaseYear,
            duration: req.body.duration,
            language: req.body.language,
            videoTags: req.body.videoTags,
            videoDescription: req.body.videoDescription
        };

        // Generate HTML content
        const htmlContent = generateVideoPage(videoData);

        // Ensure videos directory exists
        const videosDir = path.join(__dirname, 'public', 'videos');
        if (!fs.existsSync(videosDir)){
            fs.mkdirSync(videosDir);
        }

        // Generate unique filename
        const filename = `video_${videoData.id}.html`;
        const outputPath = path.join(videosDir, filename);

        // Save generated HTML
        fs.writeFileSync(outputPath, htmlContent);

        // Add HTML link to video data
        videoData.htmlLink = `/videos/${filename}`;

        // Create video in database
        await Video.create(videoData);

        // Respond with HTML content
        res.send(htmlContent);
    } catch (error) {
        console.error('Error uploading video:', error);
        res.status(500).send('Error uploading video');
    }
});

// Route to get all videos
app.get('/videos', async (req, res) => {
    try {
        const videos = await Video.findAll();
        res.json(videos);
    } catch (error) {
        console.error('Error fetching videos:', error);
        res.status(500).json({ error: 'Unable to fetch videos' });
    }
});

// Route to get a specific video by ID
app.get('/videos/:id', async (req, res) => {
    try {
        const video = await Video.findByPk(req.params.id);
        if (video) {
            res.json(video);
        } else {
            res.status(404).json({ error: 'Video not found' });
        }
    } catch (error) {
        console.error('Error fetching video:', error);
        res.status(500).json({ error: 'Unable to fetch video' });
    }
});

// Game upload route
app.post('/upload-game', upload.single('gameThumbnail'), async (req, res) => {
    try {
        const gameData = {
            id: Date.now().toString(),
            gameName: req.body.gameName,
            developer: req.body.developer,
            gameThumbnail: req.file ? `/uploads/${req.file.filename}` : '',
            releaseYear: req.body.releaseYear,
            genre: req.body.genre,
            platform: req.body.platform,
            ageRating: req.body.ageRating,
            multiplayer: req.body.multiplayer,
            keyFeatures: req.body.keyFeatures,
            gameDescription: req.body.gameDescription,
            embedCode: req.body.embedCode,
            gameLink: req.body.gameLink || ''
        };

        // Generate HTML content
        const htmlContent = generateGamePage(gameData);

        // Ensure games directory exists
        const gamesDir = path.join(__dirname, 'public', 'games');
        if (!fs.existsSync(gamesDir)){
            fs.mkdirSync(gamesDir);
        }

        // Generate unique filename
        const filename = `game_${gameData.id}.html`;
        const outputPath = path.join(gamesDir, filename);

        // Save generated HTML
        fs.writeFileSync(outputPath, htmlContent);

        // Add HTML link to game data
        gameData.htmlLink = `/games/${filename}`;

        // Create game in database
        await Game.create(gameData);

        // Respond with HTML content
        res.send(htmlContent);
    } catch (error) {
        console.error('Error uploading game:', error);
        res.status(500).send('Error uploading game');
    }
});

// Game update route
app.post('/update-game/:id', upload.single('gameThumbnail'), async (req, res) => {
    try {
        const gameId = req.params.id;
        const existingGame = await Game.findByPk(gameId);
        
        if (!existingGame) {
            return res.status(404).send('Game not found');
        }

        // Update game data
        const gameData = {
            gameName: req.body.gameName,
            developer: req.body.developer,
            releaseYear: req.body.releaseYear,
            genre: req.body.genre,
            platform: req.body.platform,
            ageRating: req.body.ageRating,
            multiplayer: req.body.multiplayer,
            keyFeatures: req.body.keyFeatures,
            gameDescription: req.body.gameDescription,
            embedCode: req.body.embedCode,
            gameLink: req.body.gameLink || ''
        };

        // Only update image if a new one is provided
        if (req.file) {
            gameData.gameThumbnail = `/uploads/${req.file.filename}`;
        }

        // Update database record
        await existingGame.update(gameData);

        // Refresh the full game data
        const updatedGame = await Game.findByPk(gameId);
        const updatedGameData = updatedGame.toJSON();

        // Generate updated HTML content
        const htmlContent = generateGamePage(updatedGameData);

        // Save updated HTML
        const gamesDir = path.join(__dirname, 'public', 'games');
        const filename = `game_${gameId}.html`;
        const outputPath = path.join(gamesDir, filename);
        fs.writeFileSync(outputPath, htmlContent);

        // Respond with updated HTML content
        res.send(htmlContent);
    } catch (error) {
        console.error('Error updating game:', error);
        res.status(500).send('Error updating game');
    }
});

// Route to get all games
app.get('/games', async (req, res) => {
    try {
        const games = await Game.findAll();
        res.json(games);
    } catch (error) {
        console.error('Error fetching games:', error);
        res.status(500).json({ error: 'Unable to fetch games' });
    }
});

// Route to get a specific game by ID
app.get('/games/:id', async (req, res) => {
    try {
        const game = await Game.findByPk(req.params.id);
        if (game) {
            res.json(game);
        } else {
            res.status(404).json({ error: 'Game not found' });
        }
    } catch (error) {
        console.error('Error fetching game:', error);
        res.status(500).json({ error: 'Unable to fetch game' });
    }
});


// Route to get a specific video by ID
app.get('/videos/:id', async (req, res) => {
    try {
        const video = await Video.findByPk(req.params.id);
        if (video) {
            res.json(video);
        } else {
            res.status(404).json({ error: 'Video not found' });
        }
    } catch (error) {
        console.error('Error fetching video:', error);
        res.status(500).json({ error: 'Unable to fetch video' });
    }
});

// Book page generation function
function generateBookPage(data) {
    const readBookButton = data.bookLink 
        ? `<a href="${data.bookLink}" target="_blank" class="read-btn">Read Book</a>` 
        : '';
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- Bootstrap CSS -->
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.0/css/bootstrap.min.css" integrity="sha384-9aIt2nRpC12Uk9gS9baDl411NQApFmC26EwAOH8WgZl5MYYxFfc+NcPb1dKGj7Sk" crossorigin="anonymous">
    <link href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo&display=swap" rel="stylesheet">
    <link rel="stylesheet" type="text/css" href="/icons/font/flaticon.css">
    <title>Browsing page</title>
    <style type="text/css">
        .jumbotron {
            background-image: url("https://images.unsplash.com/photo-1532012197267-da84d127e765?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D");
            color:floralwhite;
            background-size: cover;
        }
        #advanced-form {
            display: none;
        }

        #header {
            font-family:'Nanum Myeongjo', serif;
        }

        .container_img {
          position: relative;
          width: 100%;
        }

        .image {
          opacity: 1;
          display: block;
          width: 100%;
          height: auto;
          transition: .5s ease;
          backface-visibility: hidden;
        }

        .container_img:hover .image {
          opacity: 0.5;
        }

        iframe{
          padding: 1em;
        }

        #iframe_container{
          margin-top: 2em;
          display: flex;
          justify-content: center;
        }

         /* New CSS for Read Button */
         .read-btn {
            display: block;
            width: 200px;
            margin: 20px auto;
            padding: 10px 20px;
            background-color: #007bff;
            color: white;
            text-align: center;
            text-decoration: none;
            border-radius: 5px;
            transition: background-color 0.3s ease;
        }

        .read-btn:hover {
            background-color: #0056b3;
            color: white;
            text-decoration: none;
        }

        .navbar {
            background-color: rgba(0,0,0,0.7);
            font-family: 'Nanum Myeongjo', serif;
        }

        .navbar-brand, .navbar-nav .nav-link {
            color: floralwhite !important;
        }
    </style>
</head>
<body>
    <!-- Navigation -->
    <nav class="navbar navbar-expand-lg navbar-dark">
        <a class="navbar-brand" href="/">THE MULTIMEDIA STORE</a>
        <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarNav">
            <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
            <ul class="navbar-nav ml-auto">
                <li class="nav-item">
                    <a class="nav-link" href="/index.html">Home</a>
                </li>
                <li class="nav-item" id="loginNavItem">
                    <a class="nav-link" href="/login.html">Login</a>
                </li>
                <li class="nav-item" id="registerNavItem">
                    <a class="nav-link" href="/register.html">Register</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="/contact.html">Contact</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="/about.html">About me</a>
                </li>
                <li class="nav-item" id="logoutNavItem" style="display:none;">
                    <a class="nav-link" href="#" onclick="logout()">Logout</a>
                </li>
            </ul>
        </div>
    </nav>

    <div class="jumbotron">
    <br><br>
     <div id="header">
      <h1 class=display-3 style="text-align:center;"><strong>THE MULTIMEDIA STORE</strong></h1>
      <p class="lead" style="text-align:center;"><strong>Unlock the power of multimedia—innovation, quality, and creativity in one place!</strong></p>
  </div>
    </div>

    <div class="container">
    <div class="text-center">
      <h3 class="my-5">${data.bookName}</h3>
       
      <img src="${data.bookImage}" class="rounded mb-5" alt="${data.bookName} Book Cover" usemap="#book_map">
      <map id="book_map" name="book_map">
        <area shape="poly" coords="300, 471, 360, 437, 382, 472, 383, 563, 370, 599, 296, 473" href="https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Book_icon.svg/220px-Book_icon.svg.png" target="_blank" alt="Book Icon" title="Book Icon">
      </map>
      ${data.bookPdf ? `<a href="${data.bookPdf}" class="read-btn" target="_blank">Read PDF</a>` : ''}
    </div>

    <table class="table">
      <thead>
        <tr>
          <th scope="col">Author</th>
          <td>${data.authorName}</td>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">Birth/Death</th>
          <td>${data.birthYear} - ${data.deathYear}</td>
        </tr>
        <tr>
          <th scope="row">Language</th>
          <td>${data.language}</td>
        </tr>
        <tr>
          <th scope="row">Genre</th>
          <td>${data.genre}</td>
        </tr>
        <tr>
          <th scope="row">Literary Movement</th>
          <td>${data.literaryMovement}</td>
        </tr>
        <tr>
          <th scope="row">Important Themes</th>
          <td>${data.importantThemes}</td>
        </tr>
        <tr>
          <th scope="row">Key Characters</th>
          <td>${data.keyCharacters}</td>
        </tr>
      </tbody>
    </table>

    ${data.bookSummary.split('\n').map(paragraph => `<p>${paragraph}</p>`).join('')}

    <div id="iframe_container">
        <iframe width="560" height="315" src="${data.youtubeLink}" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
    </div>

    <br>
    <br>
    </div>
    </div>
    <br><br><hr>
    <div class="container">
        <!-- Footer -->
        <footer class="page-footer font-small pt-4">
          <div class="container-fluid text-center text-md-left">
            <div class="row justify-content-around">
              <div class="col-md-6 mt-md-0 mt-3">
              </div>
            </div>
          </div>
          <div class="footer-copyright text-center py-3"><p>&copy; 2025 THE MULTIMEDIA STORE.</p></div>
        </footer>
    </div>

    <script>

    formData.append('bookLink', document.getElementById('bookLink').value);

    // Check authentication status when the page loads
    document.addEventListener('DOMContentLoaded', function() {
        checkAuth();
    });

    function checkAuth() {
        // Get authentication data from localStorage
        const token = localStorage.getItem('userToken');
        
        if (token) {
            // User is logged in
            // Hide login and register links
            document.getElementById('loginNavItem').style.display = 'none';
            document.getElementById('registerNavItem').style.display = 'none';
            // Show logout link
            document.getElementById('logoutNavItem').style.display = 'block';
        } else {
            // User is not logged in
            // Show login and register links
            document.getElementById('loginNavItem').style.display = 'block';
            document.getElementById('registerNavItem').style.display = 'block';
            // Hide logout link
            document.getElementById('logoutNavItem').style.display = 'none';
        }
    }
        
    // Function to handle logout
    function logout() {
        // Clear user data from localStorage
        localStorage.removeItem('userToken');
        localStorage.removeItem('userName');
        localStorage.removeItem('userRole');
        
        // Update navigation after logout
        checkAuth();
        
        // Redirect to home page
        window.location.href = 'index.html';
    }
        
    // Add this function to show login message
    function showLoginMessage(event) {
        event.preventDefault();
        alert('Please log in first to view book details.');
        // Optionally redirect to login page after a short delay
        setTimeout(function() {
            window.location.href = 'login.html';
        }, 1000);
    }
    </script>

    <!-- Bootstrap JS and dependencies -->
    <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.5.3/dist/umd/popper.min.js"></script>
    <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.0/js/bootstrap.min.js"></script>
</body>
</html>
    `;
}

// Video page generation function
function generateVideoPage(data) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- Bootstrap CSS -->
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.0/css/bootstrap.min.css" integrity="sha384-9aIt2nRpC12Uk9gS9baDl411NQApFmC26EwAOH8WgZl5MYYxFfc+NcPb1dKGj7Sk" crossorigin="anonymous">
    <link href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo&display=swap" rel="stylesheet">
    <link rel="stylesheet" type="text/css" href="/icons/font/flaticon.css">
    <title>${data.videoTitle} - The Multimedia Store</title>
    <style type="text/css">
        .jumbotron {
    background-image: url("https://images.unsplash.com/photo-1611162616475-46b635cb6868?q=80&w=1974&auto=format&fit=crop");
    color: floralwhite;
    background-size: cover;
    background-position: center;
    background-color: rgba(0,0,0,0.7);
    background-blend-mode: overlay;
    padding: 3rem 1rem;
    margin-bottom: 2rem;
    height: auto;
    min-height: 300px;
    display: flex;
    align-items: center;
    justify-content: center;
}

        #header {
            font-family:'Nanum Myeongjo', serif;
        }

        .container_img {
          position: relative;
          width: 100%;
        }

        .image {
          opacity: 1;
          display: block;
          width: 100%;
          height: auto;
          transition: .5s ease;
          backface-visibility: hidden;
        }

        .container_img:hover .image {
          opacity: 0.5;
        }

        iframe {
          width: 100%;
          height: 450px;
          padding: 1em;
        }

        #iframe_container {
          margin-top: 2em;
          display: flex;
          justify-content: center;
        }

        .navbar {
            background-color: rgba(0,0,0,0.7);
            font-family: 'Nanum Myeongjo', serif;
        }

        .navbar-brand, .navbar-nav .nav-link {
            color: floralwhite !important;
        }
        
        .video-thumbnail {
            max-width: 400px;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        
        .tag-badge {
            margin-right: 5px;
            margin-bottom: 5px;
        }
    </style>
</head>
<body>
    <!-- Navigation -->
    <nav class="navbar navbar-expand-lg navbar-dark">
        <a class="navbar-brand" href="/index.html">THE VIDEOS STORE</a>
        <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarNav">
            <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
            <ul class="navbar-nav ml-auto">
                <li class="nav-item">
                    <a class="nav-link" href="/index.html">Home</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="/video-list.html">Videos</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="/login.html">Login</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="/register.html">Register</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="/contact.html">Contact</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="/about.html">About</a>
                </li>
            </ul>
        </div>
    </nav>

    <div class="jumbotron">
        <br><br>
        <div id="header">
            <h1 class="display-3 text-center"><strong>THE VIDEO STORE</strong></h1>
            <p class="lead text-center"><strong>Unlock the power of multimedia—innovation, quality, and creativity in one place!</strong></p>
        </div>
    </div>

    <div class="container">
        <div class="text-center mb-4">
            <h2 class="my-4">${data.videoTitle}</h2>
            <img src="${data.videoThumbnail}" class="video-thumbnail mb-4" alt="${data.videoTitle} Thumbnail">
        </div>

        <div id="iframe_container" class="mb-5">
            <iframe src="${data.videoEmbedCode}" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
        </div>

        <div class="row">
            <div class="col-md-8">
                <h3>Description</h3>
                ${data.videoDescription.split('\n').map(paragraph => `<p>${paragraph}</p>`).join('')}
            </div>
            
            <div class="col-md-4">
                <div class="card">
                    <div class="card-header bg-info text-white">
                        <h4 class="mb-0">Video Details</h4>
                    </div>
                    <ul class="list-group list-group-flush">
                        <li class="list-group-item"><strong>Creator:</strong> ${data.creator}</li>
                        ${data.releaseYear ? `<li class="list-group-item"><strong>Release Year:</strong> ${data.releaseYear}</li>` : ''}
                        ${data.duration ? `<li class="list-group-item"><strong>Duration:</strong> ${data.duration} minutes</li>` : ''}
                        ${data.genre ? `<li class="list-group-item"><strong>Genre:</strong> ${data.genre}</li>` : ''}
                        ${data.language ? `<li class="list-group-item"><strong>Language:</strong> ${data.language}</li>` : ''}
                    </ul>
                </div>
                
                ${data.videoTags ? `
                <div class="card mt-4">
                    <div class="card-header bg-info text-white">
                        <h4 class="mb-0">Tags</h4>
                    </div>
                    <div class="card-body">
                        ${data.videoTags.split(',').map(tag => `<span class="badge badge-info tag-badge">${tag.trim()}</span>`).join('')}
                    </div>
                </div>` : ''}
            </div>
        </div>
    </div>

    <br><br><hr>


    <script>
    // Check authentication status when the page loads
    document.addEventListener('DOMContentLoaded', function() {
        checkAuth();
    });

    function checkAuth() {
        // Get authentication data from localStorage
        const token = localStorage.getItem('userToken');
        
        if (token) {
            // User is logged in
            // Hide login and register links
            document.getElementById('loginNavItem').style.display = 'none';
            document.getElementById('registerNavItem').style.display = 'none';
            // Show logout link
            document.getElementById('logoutNavItem').style.display = 'block';
        } else {
            // User is not logged in
            // Show login and register links
            document.getElementById('loginNavItem').style.display = 'block';
            document.getElementById('registerNavItem').style.display = 'block';
            // Hide logout link
            document.getElementById('logoutNavItem').style.display = 'none';
        }
    }
        
    // Function to handle logout
    function logout() {
        // Clear user data from localStorage
        localStorage.removeItem('userToken');
        localStorage.removeItem('userName');
        localStorage.removeItem('userRole');
        
        // Update navigation after logout
        checkAuth();
        
        // Redirect to home page
        window.location.href = 'index.html';
    }
        
    // Add this function to show login message
    function showLoginMessage(event) {
        event.preventDefault();
        alert('Please log in first to view book details.');
        // Optionally redirect to login page after a short delay
        setTimeout(function() {
            window.location.href = 'login.html';
        }, 1000);
    }
    </script>
    
    <!-- Footer -->
    <footer class="text-center mt-5">
        <div class="container">
            <p>&copy; 2025 THE MULTIMEDIA STORE.</p>
        </div>
    </footer>

    <!-- Bootstrap JS and dependencies -->
    <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.5.3/dist/umd/popper.min.js"></script>
    <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.0/js/bootstrap.min.js"></script>
</body>
</html>
    `;
}

// Game page generation function
function generateGamePage(data) {
    const playGameButton = data.gameLink 
        ? `<a href="${data.gameLink}" target="_blank" class="play-btn">Play Game</a>` 
        : '';
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- Bootstrap CSS -->
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.0/css/bootstrap.min.css" integrity="sha384-9aIt2nRpC12Uk9gS9baDl411NQApFmC26EwAOH8WgZl5MYYxFfc+NcPb1dKGj7Sk" crossorigin="anonymous">
    <link href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo&display=swap" rel="stylesheet">
    <link rel="stylesheet" type="text/css" href="/icons/font/flaticon.css">
    <title>${data.gameName} - The Multimedia Store</title>
    <style type="text/css">
        .jumbotron {
            background-image: url("https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=2071&auto=format&fit=crop");
            color: floralwhite;
            background-size: cover;
        }

        #header {
            font-family:'Nanum Myeongjo', serif;
        }

        .container_img {
          position: relative;
          width: 100%;
        }

        .image {
          opacity: 1;
          display: block;
          width: 100%;
          height: auto;
          transition: .5s ease;
          backface-visibility: hidden;
        }

        .container_img:hover .image {
          opacity: 0.5;
        }

        iframe {
          width: 100%;
          height: 450px;
          padding: 1em;
        }

        #iframe_container {
          margin-top: 2em;
          display: flex;
          justify-content: center;
        }

        .navbar {
            background-color: rgba(0,0,0,0.7);
            font-family: 'Nanum Myeongjo', serif;
        }

        .navbar-brand, .navbar-nav .nav-link {
            color: floralwhite !important;
        }
        
        .game-thumbnail {
            max-width: 400px;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            margin-bottom: 20px;
        }
        
        .feature-badge {
            margin-right: 5px;
            margin-bottom: 5px;
        }
        
        /* Play Game Button */
        .play-btn {
            display: block;
            width: 200px;
            margin: 20px auto;
            padding: 10px 20px;
            background-color: #28a745;
            color: white;
            text-align: center;
            text-decoration: none;
            border-radius: 5px;
            transition: background-color 0.3s ease;
        }

        .play-btn:hover {
            background-color: #218838;
            color: white;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <!-- Navigation -->
    <nav class="navbar navbar-expand-lg navbar-dark">
        <a class="navbar-brand" href="/index.html">THE GAMES STORE</a>
        <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarNav">
            <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
            <ul class="navbar-nav ml-auto">
                <li class="nav-item">
                    <a class="nav-link" href="/index.html">Home</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="/game-list.html">Games</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="/login.html">Login</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="/register.html">Register</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="/contact.html">Contact</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="/about.html">About</a>
                </li>
            </ul>
        </div>
    </nav>

    <div class="jumbotron">
        <br><br>
        <div id="header">
            <h1 class="display-3 text-center"><strong>THE GAME STORE</strong></h1>
            <p class="lead text-center"><strong>Unlock the power of multimedia—innovation, quality, and creativity in one place!</strong></p>
        </div>
    </div>

    <div class="container">
        <div class="text-center mb-4">
            <h2 class="my-4">${data.gameName}</h2>
            <img src="${data.gameThumbnail}" class="game-thumbnail" alt="${data.gameName} Thumbnail">
            ${playGameButton}
        </div>

        ${data.embedCode ? `
        <div id="iframe_container" class="mb-5">
            <iframe src="${data.embedCode}" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
        </div>` : ''}

        <div class="row">
            <div class="col-md-8">
                <h3>Description</h3>
                ${data.gameDescription ? data.gameDescription.split('\n').map(paragraph => `<p>${paragraph}</p>`).join('') : '<p>No description available.</p>'}
            </div>
            
            <div class="col-md-4">
                <div class="card">
                    <div class="card-header bg-success text-white">
                        <h4 class="mb-0">Game Details</h4>
                    </div>
                    <ul class="list-group list-group-flush">
                        <li class="list-group-item"><strong>Developer:</strong> ${data.developer}</li>
                        ${data.releaseYear ? `<li class="list-group-item"><strong>Release Year:</strong> ${data.releaseYear}</li>` : ''}
                        ${data.genre ? `<li class="list-group-item"><strong>Genre:</strong> ${data.genre}</li>` : ''}
                        ${data.platform ? `<li class="list-group-item"><strong>Platform:</strong> ${data.platform}</li>` : ''}
                        ${data.ageRating ? `<li class="list-group-item"><strong>Age Rating:</strong> ${data.ageRating}</li>` : ''}
                        ${data.multiplayer ? `<li class="list-group-item"><strong>Multiplayer:</strong> ${data.multiplayer}</li>` : ''}
                    </ul>
                </div>
                
                ${data.keyFeatures ? `
                <div class="card mt-4">
                    <div class="card-header bg-success text-white">
                        <h4 class="mb-0">Key Features</h4>
                    </div>
                    <div class="card-body">
                        ${data.keyFeatures.split(',').map(feature => `<span class="badge badge-success feature-badge">${feature.trim()}</span>`).join('')}
                    </div>
                </div>` : ''}
            </div>
        </div>
    </div>

    <br><br><hr>


    <script>
    // Check authentication status when the page loads
    document.addEventListener('DOMContentLoaded', function() {
        checkAuth();
    });

    function checkAuth() {
        // Get authentication data from localStorage
        const token = localStorage.getItem('userToken');
        
        if (token) {
            // User is logged in
            // Hide login and register links
            document.getElementById('loginNavItem').style.display = 'none';
            document.getElementById('registerNavItem').style.display = 'none';
            // Show logout link
            document.getElementById('logoutNavItem').style.display = 'block';
        } else {
            // User is not logged in
            // Show login and register links
            document.getElementById('loginNavItem').style.display = 'block';
            document.getElementById('registerNavItem').style.display = 'block';
            // Hide logout link
            document.getElementById('logoutNavItem').style.display = 'none';
        }
    }
        
    // Function to handle logout
    function logout() {
        // Clear user data from localStorage
        localStorage.removeItem('userToken');
        localStorage.removeItem('userName');
        localStorage.removeItem('userRole');
        
        // Update navigation after logout
        checkAuth();
        
        // Redirect to home page
        window.location.href = 'index.html';
    }
        
    // Add this function to show login message
    function showLoginMessage(event) {
        event.preventDefault();
        alert('Please log in first to view book details.');
        // Optionally redirect to login page after a short delay
        setTimeout(function() {
            window.location.href = 'login.html';
        }, 1000);
    }
    </script>
    
    <!-- Footer -->
    <footer class="text-center mt-5">
        <div class="container">
            <p>&copy; 2025 THE MULTIMEDIA STORE.</p>
        </div>
    </footer>

    <!-- Bootstrap JS and dependencies -->
    <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.5.3/dist/umd/popper.min.js"></script>
    <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.0/js/bootstrap.min.js"></script>
</body>
</html>
    `;
}

// other require statements at the top of server.js
const Painting = require('./models/Painting');

// Add these routes to your server.js (but don't duplicate the sequelize declaration)
// Painting upload route
app.post('/upload-painting', upload.single('paintingImage'), async (req, res) => {
    try {
        const paintingData = {
            id: Date.now().toString(),
            paintingName: req.body.paintingName,
            artistName: req.body.artistName,
            paintingImage: req.file ? `/uploads/${req.file.filename}` : '',
            yearCreated: req.body.yearCreated,
            medium: req.body.medium,
            dimensions: req.body.dimensions,
            artMovement: req.body.artMovement,
            currentLocation: req.body.currentLocation,
            technique: req.body.technique,
            mainSubject: req.body.mainSubject,
            paintingDescription: req.body.paintingDescription,
            primaryVideo: req.body.primaryVideo,
            artistVideo: req.body.artistVideo,
            technicalVideo: req.body.technicalVideo,
            virtualTour: req.body.virtualTour || ''
        };

        // Generate HTML content
        const htmlContent = generatePaintingPage(paintingData);

        // paintings directory exists
        const paintingsDir = path.join(__dirname, 'public', 'paintings');
        if (!fs.existsSync(paintingsDir)){
            fs.mkdirSync(paintingsDir, { recursive: true });
        }

        // Generate unique filename
        const filename = `painting_${paintingData.id}.html`;
        const outputPath = path.join(paintingsDir, filename);

        // Save generated HTML
        fs.writeFileSync(outputPath, htmlContent);

        // Add HTML link to painting data
        paintingData.htmlLink = `/paintings/${filename}`;

        // Create painting in database
        await Painting.create(paintingData);

        // Respond with HTML content
        res.send(htmlContent);
    } catch (error) {
        console.error('Error uploading painting:', error);
        res.status(500).send('Error uploading painting');
    }
});

// Route to get all paintings
app.get('/paintings', async (req, res) => {
    try {
        const paintings = await Painting.findAll();
        res.json(paintings);
    } catch (error) {
        console.error('Error fetching paintings:', error);
        res.status(500).json({ error: 'Unable to fetch paintings' });
    }
});

// Route to get a specific painting by ID
app.get('/paintings/:id', async (req, res) => {
    try {
        const painting = await Painting.findByPk(req.params.id);
        if (painting) {
            res.json(painting);
        } else {
            res.status(404).json({ error: 'Painting not found' });
        }
    } catch (error) {
        console.error('Error fetching painting:', error);
        res.status(500).json({ error: 'Unable to fetch painting' });
    }
});

// Add the generatePaintingPage function
function generatePaintingPage(data) {
    const virtualTourButton = data.virtualTour 
        ? `<a href="${data.virtualTour}" target="_blank" class="gallery-btn mt-4">Virtual Gallery Tour</a>` 
        : '';
    
    // Create video sections based on which ones are provided
    let videoContent = '';
    
    if (data.primaryVideo) {
        videoContent += `
        <div class="video-container mb-5">
            <h4 class="mb-3">About This Painting</h4>
            <div class="embed-responsive embed-responsive-16by9">
                <iframe class="embed-responsive-item" src="${data.primaryVideo}" allowfullscreen></iframe>
            </div>
        </div>`;
    }
    
    if (data.artistVideo) {
        videoContent += `
        <div class="video-container mb-5">
            <h4 class="mb-3">About The Artist</h4>
            <div class="embed-responsive embed-responsive-16by9">
                <iframe class="embed-responsive-item" src="${data.artistVideo}" allowfullscreen></iframe>
            </div>
        </div>`;
    }
    
    if (data.technicalVideo) {
        videoContent += `
        <div class="video-container mb-5">
            <h4 class="mb-3">Technical Analysis</h4>
            <div class="embed-responsive embed-responsive-16by9">
                <iframe class="embed-responsive-item" src="${data.technicalVideo}" allowfullscreen></iframe>
            </div>
        </div>`;
    }
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- Bootstrap CSS -->
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.0/css/bootstrap.min.css" integrity="sha384-9aIt2nRpC12Uk9gS9baDl411NQApFmC26EwAOH8WgZl5MYYxFfc+NcPb1dKGj7Sk" crossorigin="anonymous">
    <link href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo&display=swap" rel="stylesheet">
    <link rel="stylesheet" type="text/css" href="/icons/font/flaticon.css">
    <title>${data.paintingName} - The Multimedia Store</title>
    <style type="text/css">
.jumbotron {
    background-image: url("https://images.unsplash.com/photo-1577083288073-40892c0860a4?q=80&w=2000&auto=format&fit=crop");
    color: floralwhite;
    background-size: cover;
    background-position: center;
    background-color: rgba(0,0,0,0.5);
    background-blend-mode: overlay;
    padding: 3rem 1rem;
    margin-bottom: 2rem;
    height: auto;
    min-height: 320px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-shadow: 1px 1px 3px rgba(0,0,0,0.6);
}

        #header {
            font-family:'Nanum Myeongjo', serif;
        }

        body {
            font-family: 'Nanum Myeongjo', serif;
        }

        .painting-container {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }

        .painting-img {
            max-width: 100%;
            height: auto;
            border-radius: 5px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }

        .info-table {
            margin-top: 30px;
        }

        .video-container {
            margin-top: 40px;
        }

        iframe {
            border-radius: 8px;
        }

        .gallery-btn {
            display: inline-block;
            padding: 10px 20px;
            background-color: #3498db;
            color: white;
            text-align: center;
            text-decoration: none;
            border-radius: 5px;
            transition: background-color 0.3s ease;
        }
        
        .gallery-btn:hover {
            background-color: #2980b9;
            color: white;
            text-decoration: none;
        }
        
        .download-btn {
            display: inline-block;
            padding: 10px 20px;
            background-color: #27ae60;
            color: white;
            text-align: center;
            text-decoration: none;
            border-radius: 5px;
            margin-left: 10px;
            transition: background-color 0.3s ease;
        }
        
        .download-btn:hover {
            background-color: #219251;
            color: white;
            text-decoration: none;
        }
        
        .navbar {
            background-color: rgba(0,0,0,0.7);
            font-family: 'Nanum Myeongjo', serif;
        }

        .navbar-brand, .navbar-nav .nav-link {
            color: floralwhite !important;
        }
    </style>
</head>
<body>
    <!-- Navigation -->
    <nav class="navbar navbar-expand-lg navbar-dark">
        <a class="navbar-brand" href="/index">THE PAINTING STORE</a>
        <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarNav">
            <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
            <ul class="navbar-nav ml-auto">
                <li class="nav-item">
                    <a class="nav-link" href="/index.html">Home</a>
                </li>
                <li class="nav-item" id="loginNavItem">
                    <a class="nav-link" href="/login.html">Login</a>
                </li>
                <li class="nav-item" id="registerNavItem">
                    <a class="nav-link" href="/register.html">Register</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="/contact.html">Contact</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="/about.html">About me</a>
                </li>
                <li class="nav-item" id="logoutNavItem" style="display:none;">
                    <a class="nav-link" href="#" onclick="logout()">Logout</a>
                </li>
            </ul>
        </div>
    </nav>

    <div class="jumbotron">
    <br><br>
     <div id="header">
      <h1 class=display-3 style="text-align:center;"><strong>THE PAINTING STORE</strong></h1>
      <p class="lead" style="text-align:center;"><strong>Unlock the power of multimedia—innovation, quality, and creativity in one place!</strong></p>
     </div>
    </div>

    <div class="container">
        <div class="painting-container my-5">
            <div class="row">
                <div class="col-md-8 mb-4">
                    <h2 class="mb-4 text-center">${data.paintingName}</h2>
                    <div class="text-center">
                        <img src="${data.paintingImage}" alt="${data.paintingName}" class="painting-img">
                        <div class="mt-3">
                            ${virtualTourButton}
                            <a href="${data.paintingImage}" download="${data.paintingName}" class="download-btn" onclick="return checkDownloadAuth(event)">
                                <i class="flaticon-download"></i> Download
                            </a>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <h4 class="mb-3">About the Painting</h4>
                    <table class="table info-table">
                        <tbody>
                            <tr>
                                <th>Artist</th>
                                <td>${data.artistName}</td>
                            </tr>
                            <tr>
                                <th>Year</th>
                                <td>${data.yearCreated}</td>
                            </tr>
                            <tr>
                                <th>Medium</th>
                                <td>${data.medium}</td>
                            </tr>
                            <tr>
                                <th>Dimensions</th>
                                <td>${data.dimensions}</td>
                            </tr>
                            <tr>
                                <th>Art Movement</th>
                                <td>${data.artMovement}</td>
                            </tr>
                            <tr>
                                <th>Current Location</th>
                                <td>${data.currentLocation}</td>
                            </tr>
                            <tr>
                                <th>Technique</th>
                                <td>${data.technique}</td>
                            </tr>
                            <tr>
                                <th>Main Subject</th>
                                <td>${data.mainSubject}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="row mt-4">
                <div class="col-12">
                    <h4 class="mb-3">Description</h4>
                    ${data.paintingDescription.split('\\n').map(paragraph => `<p>${paragraph}</p>`).join('')}
                </div>
            </div>

            <div class="row">
                <div class="col-12">
                    ${videoContent}
                </div>
            </div>
        </div>
    </div>

    <div class="container">
        <!-- Footer -->
        <footer class="page-footer font-small pt-4">
          <div class="container-fluid text-center text-md-left">
            <div class="row justify-content-around">
              <div class="col-md-6 mt-md-0 mt-3">
              </div>
            </div>
          </div>
          <div class="footer-copyright text-center py-3"><p>&copy; 2025 THE MULTIMEDIA STORE.</p></div>
        </footer>
    </div>


     <script>
    // Check authentication status when the page loads
    document.addEventListener('DOMContentLoaded', function() {
        checkAuth();
    });

    function checkAuth() {
        // Get authentication data from localStorage
        const token = localStorage.getItem('userToken');
        
        if (token) {
            // User is logged in
            // Hide login and register links
            document.getElementById('loginNavItem').style.display = 'none';
            document.getElementById('registerNavItem').style.display = 'none';
            // Show logout link
            document.getElementById('logoutNavItem').style.display = 'block';
        } else {
            // User is not logged in
            // Show login and register links
            document.getElementById('loginNavItem').style.display = 'block';
            document.getElementById('registerNavItem').style.display = 'block';
            // Hide logout link
            document.getElementById('logoutNavItem').style.display = 'none';
        }
    }
        
    // Function to handle logout
    function logout() {
        // Clear user data from localStorage
        localStorage.removeItem('userToken');
        localStorage.removeItem('userName');
        localStorage.removeItem('userRole');
        
        // Update navigation after logout
        checkAuth();
        
        // Redirect to home page
        window.location.href = 'index.html';
    }
        
    // Add this function to show login message
    function showLoginMessage(event) {
        event.preventDefault();
        alert('Please log in first to view painting details.');
        // Optionally redirect to login page after a short delay
        setTimeout(function() {
            window.location.href = 'login.html';
        }, 1000);
    }
    
    // Function to check if user is authorized to download
    function checkDownloadAuth(event) {
        // Get authentication data from localStorage
        const token = localStorage.getItem('userToken');
        
        if (!token) {
            // User is not logged in
            event.preventDefault();
            alert('Please log in to download this painting.');
            // Redirect to login page after a short delay
            setTimeout(function() {
                window.location.href = 'login.html';
            }, 1000);
            return false;
        }
        return true;
    }
    </script>

    <!-- Bootstrap JS and dependencies -->
    <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.5.3/dist/umd/popper.min.js"></script>
    <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.0/js/bootstrap.min.js"></script>
</body>
</html>
`;
}

// Article creation route
app.post('/create-article', upload.any(), async (req, res) => {
    try {
        // Organize the uploaded files
        const files = {
            articleCover: req.files.find(f => f.fieldname === 'articleCover'),
            imageBlocks: req.files.filter(f => f.fieldname.startsWith('image-block-'))
        };

        // Parse the blocks data
        const blocksData = JSON.parse(req.body.blocksData);
        
        // Prepare article data
        const articleData = {
            id: Date.now().toString(),
            title: req.body.articleTitle,
            authorName: req.body.authorName,
            shortDescription: req.body.articleShortDescription,
            categories: req.body.categories,
            coverImage: files.articleCover ? `/uploads/${files.articleCover.filename}` : null,
            createdAt: new Date()
        };

        // Process content blocks
        const contentBlocks = [];
        blocksData.forEach(block => {
            const blockContent = {
                type: block.type,
                content: block.content || '',
                position: block.position
            };

            // Handle image blocks
            if (block.type === 'image' && block.fileReference) {
                const blockId = block.fileReference.replace('image-block-', '');
                const file = files.imageBlocks.find(f => f.fieldname === `image-block-${blockId}`);
                if (file) {
                    blockContent.imageUrl = `/uploads/${file.filename}`;
                    blockContent.caption = block.caption || '';
                }
            }

            contentBlocks.push(blockContent);
        });

        // Store blocks as JSON in content field
        articleData.content = JSON.stringify(contentBlocks);

        // Generate HTML content
        const htmlContent = generateArticlePage(articleData, contentBlocks);

        // Ensure articles directory exists
        const articlesDir = path.join(__dirname, 'public', 'articles');
        if (!fs.existsSync(articlesDir)){
            fs.mkdirSync(articlesDir);
        }

        // Generate unique filename
        const filename = `article_${articleData.id}.html`;
        const outputPath = path.join(articlesDir, filename);

        // Save generated HTML
        fs.writeFileSync(outputPath, htmlContent);

        // Add HTML link to article data
        articleData.htmlLink = `/articles/${filename}`;

        // Create article in database
        await Article.create(articleData);

        // Respond with HTML content
        res.send(htmlContent);
    } catch (error) {
        console.error('Error creating article:', error);
        res.status(500).send('Error creating article');
    }
});

// Route to get all articles
app.get('/articles', async (req, res) => {
    try {
        const articles = await Article.findAll({
            order: [['createdAt', 'DESC']]
        });
        res.json(articles);
    } catch (error) {
        console.error('Error fetching articles:', error);
        res.status(500).json({ error: 'Unable to fetch articles' });
    }
});

// Route to get a specific article by ID
app.get('/articles/:id', async (req, res) => {
    try {
        const article = await Article.findByPk(req.params.id);
        if (article) {
            res.json(article);
        } else {
            res.status(404).json({ error: 'Article not found' });
        }
    } catch (error) {
        console.error('Error fetching article:', error);
        res.status(500).json({ error: 'Unable to fetch article' });
    }
});

// Article page generation function
function generateArticlePage(article, blocks) {
    const parsedBlocks = typeof blocks === 'string' ? JSON.parse(blocks) : blocks;
    
    let contentHTML = '';
    parsedBlocks.forEach(block => {
        switch(block.type) {
            case 'heading':
                contentHTML += `<h3 class="mt-4">${block.content}</h3>`;
                break;
            case 'subheading':
                contentHTML += `<h4 class="mt-3">${block.content}</h4>`;
                break;
            case 'paragraph':
                contentHTML += `<p>${block.content}</p>`;
                break;
            case 'image':
                if (block.imageUrl) {
                    contentHTML += `
                        <div class="text-center mb-3">
                            <img src="${block.imageUrl}" class="img-fluid" alt="Article Image">
                            ${block.caption ? `<p class="text-muted mt-1"><small>${block.caption}</small></p>` : ''}
                        </div>
                    `;
                }
                break;
            case 'video':
                if (block.content) {
                    contentHTML += `
                        <div class="embed-responsive embed-responsive-16by9 mb-3">
                            <iframe class="embed-responsive-item" src="${block.content}" allowfullscreen></iframe>
                        </div>
                    `;
                }
                break;
        }
    });

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${article.title} - The Multimedia Store</title>
    <!-- Bootstrap CSS -->
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.0/css/bootstrap.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Nanum Myeongjo', serif;
            background-color: #f4f4f4;
        }
                .jumbotron {
    background-image: url("https://images.unsplash.com/photo-1585241936939-be4099591252?q=80&w=2000&auto=format&fit=crop");
    color: floralwhite;
    background-size: cover;
    background-position: center;
    background-color: rgba(0,0,0,0.7);
    background-blend-mode: overlay;
}

        .navbar {
            background-color: rgba(0,0,0,0.7);
            font-family: 'Nanum Myeongjo', serif;
        }
        .navbar-brand, .navbar-nav .nav-link {
            color: floralwhite !important;
        }
        .article-content {
            background-color: white;
            padding: 30px;
            border-radius: 5px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .article-cover {
            max-height: 400px;
            object-fit: cover;
            margin-bottom: 20px;
            width: 100%;
        }
        .category-badge {
            margin-right: 5px;
            margin-bottom: 5px;
        }
    </style>
</head>
<body>
    <!-- Navigation -->
    <nav class="navbar navbar-expand-lg navbar-dark">
        <a class="navbar-brand" href="/index.html">THE ARTICLE & NEWS STORE</a>
        <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarNav">
            <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
            <ul class="navbar-nav ml-auto">
                <li class="nav-item">
                    <a class="nav-link" href="/index.html">Home</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="/article-list.html">Article List</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="/login.html">Login</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="/register.html">Register</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="/contact.html">Contact</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="/about.html">About</a>
                </li>
            </ul>
        </div>
    </nav>

    <div class="jumbotron">
        <div class="container text-center">
            <h1 class="display-4">${article.title}</h1>
            <p class="lead">By ${article.authorName}</p>
        </div>
    </div>

    <div class="container my-5">
        <div class="row">
            <div class="col-lg-8 mx-auto">
                <div class="article-content">
                    ${article.coverImage ? `<img src="${article.coverImage}" class="article-cover" alt="Article Cover">` : ''}
                    
                    <p class="lead">${article.shortDescription}</p>
                    
                    ${article.categories ? `
                    <div class="mb-4">
                        ${article.categories.split(',').map(category => 
                            `<span class="badge badge-info category-badge">${category.trim()}</span>`
                        ).join('')}
                    </div>
                    ` : ''}
                    
                    <hr>
                    
                    ${contentHTML}
                </div>
            </div>
        </div>
    </div>

    <!-- Footer -->
    <footer class="text-center py-4 bg-dark text-white">
        <div class="container">
            <p>&copy; 2025 THE MULTIMEDIA STORE. All rights reserved.</p>
        </div>
    </footer>


     <script>
    // Check authentication status when the page loads
    document.addEventListener('DOMContentLoaded', function() {
        checkAuth();
    });

    function checkAuth() {
        // Get authentication data from localStorage
        const token = localStorage.getItem('userToken');
        
        if (token) {
            // User is logged in
            // Hide login and register links
            document.getElementById('loginNavItem').style.display = 'none';
            document.getElementById('registerNavItem').style.display = 'none';
            // Show logout link
            document.getElementById('logoutNavItem').style.display = 'block';
        } else {
            // User is not logged in
            // Show login and register links
            document.getElementById('loginNavItem').style.display = 'block';
            document.getElementById('registerNavItem').style.display = 'block';
            // Hide logout link
            document.getElementById('logoutNavItem').style.display = 'none';
        }
    }
        
    // Function to handle logout
    function logout() {
        // Clear user data from localStorage
        localStorage.removeItem('userToken');
        localStorage.removeItem('userName');
        localStorage.removeItem('userRole');
        
        // Update navigation after logout
        checkAuth();
        
        // Redirect to home page
        window.location.href = 'index.html';
    }
        
    // Add this function to show login message
    function showLoginMessage(event) {
        event.preventDefault();
        alert('Please log in first to view book details.');
        // Optionally redirect to login page after a short delay
        setTimeout(function() {
            window.location.href = 'login.html';
        }, 1000);
    }
    </script>

    <!-- Bootstrap JS and dependencies -->
    <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.5.3/dist/umd/popper.min.js"></script>
    <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.0/js/bootstrap.min.js"></script>
</body>
</html>
    `;
}

// Multer storage configuration for newspaper uploads
const newspaperStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads', 'newspapers');
        if (!fs.existsSync(uploadDir)){
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const newspaperUpload = multer({ 
    storage: newspaperStorage,
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'newspaperPdf' && path.extname(file.originalname).toLowerCase() !== '.pdf') {
            return cb(new Error('Only PDF files are allowed for newspaper upload'));
        }
        cb(null, true);
    }
});

// Function to generate newspaper HTML page
function generateNewspaperPage(data) {
    const formattedDate = new Date(data.publishDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const editionLabels = {
        'morning': 'Morning Edition',
        'evening': 'Evening Edition',
        'special': 'Special Edition',
        'weekend': 'Weekend Edition'
    };

    const editionLabel = editionLabels[data.editionType] || 'Edition';

    let keywordsHTML = '';
    if (data.keywords && data.keywords.length > 0) {
        keywordsHTML = `
            <div class="mb-3">
                <h5>Keywords</h5>
                ${data.keywords.map(keyword => `<span class="badge badge-info mr-2">${keyword}</span>`).join('')}
            </div>
        `;
    }

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.name} - ${formattedDate} | The Multimedia Store</title>
    <!-- Bootstrap CSS -->
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.0/css/bootstrap.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css">
    <style>
        body {
            font-family: 'Nanum Myeongjo', serif;
        }
.jumbotron {
    background-image: url("https://images.unsplash.com/photo-1585241936939-be4099591252?q=80&w=2000&auto=format&fit=crop");
    color: floralwhite;
    background-size: cover;
    background-position: center;
    background-color: rgba(0,0,0,0.7);
    background-blend-mode: overlay;
}
        .newspaper-container {
            max-width: 800px;
            margin: 0 auto;
        }
        .newspaper-cover {
            max-width: 100%;
            height: auto;
            border: 1px solid #dee2e6;
            margin-bottom: 20px;
        }
        .view-pdf-btn {
            display: inline-block;
            width: 200px;
            margin: 20px 10px;
            padding: 10px 20px;
            background-color: #17a2b8;
            color: white;
            text-align: center;
            text-decoration: none;
            border-radius: 5px;
            transition: background-color 0.3s ease;
        }
        .view-pdf-btn:hover {
            background-color: #138496;
            color: white;
            text-decoration: none;
        }
        .download-btn {
            display: inline-block;
            width: 200px;
            margin: 20px 10px;
            padding: 10px 20px;
            background-color: #28a745;
            color: white;
            text-align: center;
            text-decoration: none;
            border-radius: 5px;
            transition: background-color 0.3s ease;
        }
        .download-btn:hover {
            background-color: #218838;
            color: white;
            text-decoration: none;
        }
        .navbar {
            background-color: rgba(0,0,0,0.7);
            font-family: 'Nanum Myeongjo', serif;
        }
        .navbar-brand, .navbar-nav .nav-link {
            color: floralwhite !important;
        }
        .edition-badge {
            font-size: 1rem;
            padding: 0.5rem 1rem;
            background-color: #6c757d;
            color: white;
            border-radius: 5px;
            display: inline-block;
            margin-bottom: 10px;
        }
        .date-badge {
            font-size: 1rem;
            color: #6c757d;
            margin-bottom: 15px;
            display: block;
        }
        .button-group {
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
        }
    </style>
</head>
<body>
    <!-- Navigation -->
    <nav class="navbar navbar-expand-lg navbar-dark">
        <a class="navbar-brand" href="/index.html">THE NEWSPAPER STORE</a>
        <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarNav">
            <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
            <ul class="navbar-nav ml-auto">
                <li class="nav-item">
                    <a class="nav-link" href="/index.html">Home</a>
                </li>
                <li class="nav-item active">
                    <a class="nav-link" href="/newspaper-list.html">Newspaper Archive</a>
                </li>
                <li class="nav-item" id="loginNavItem">
                    <a class="nav-link" href="/login.html">Login</a>
                </li>
                <li class="nav-item" id="registerNavItem">
                    <a class="nav-link" href="/register.html">Register</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="/contact.html">Contact</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="/about.html">About</a>
                </li>
                <li class="nav-item" id="logoutNavItem" style="display:none;">
                    <a class="nav-link" href="#" onclick="logout()">Logout</a>
                </li>
            </ul>
        </div>
    </nav>

    <div class="jumbotron">
        <div class="container text-center">
            <h1 class="display-4">${data.name}</h1>
            <p class="lead">Historical Newspaper Archive</p>
        </div>
    </div>

    <div class="container newspaper-container my-5">
        <div class="text-center">
            <span class="edition-badge">${editionLabel}</span>
            <span class="date-badge">${formattedDate}</span>
            
            ${data.coverImage ? `<img src="${data.coverImage}" class="newspaper-cover" alt="${data.name} cover">` : ''}
            
            <div class="button-group">
                <a href="${data.pdfPath}" class="view-pdf-btn" target="_blank">
                    <i class="fas fa-eye mr-2"></i>View Full PDF
                </a>
                <a href="${data.pdfPath}" class="download-btn" download="${data.name}_${formattedDate}.pdf" onclick="return checkDownloadAuth(event)">
                    <i class="fas fa-download mr-2"></i>Download PDF
                </a>
            </div>
        </div>

        ${data.description ? `
            <div class="mb-4">
                <h4>About This Edition</h4>
                <p>${data.description}</p>
            </div>
        ` : ''}

        ${keywordsHTML}

        <hr class="my-4">

        <div class="text-center mt-4">
            <a href="newspaper-list.html" class="btn btn-outline-secondary">Back to Archive</a>
        </div>
    </div>

    <!-- Footer -->
    <footer class="text-center mt-5 py-4 bg-dark text-white">
        <div class="container">
            <p class="mb-0">&copy; 2025 THE MULTIMEDIA STORE. All rights reserved.</p>
        </div>
    </footer>

     <script>
    // Check authentication status when the page loads
    document.addEventListener('DOMContentLoaded', function() {
        checkAuth();
    });

    function checkAuth() {
        // Get authentication data from localStorage
        const token = localStorage.getItem('userToken');
        
        if (token) {
            // User is logged in
            // Hide login and register links
            document.getElementById('loginNavItem').style.display = 'none';
            document.getElementById('registerNavItem').style.display = 'none';
            // Show logout link
            document.getElementById('logoutNavItem').style.display = 'block';
        } else {
            // User is not logged in
            // Show login and register links
            document.getElementById('loginNavItem').style.display = 'block';
            document.getElementById('registerNavItem').style.display = 'block';
            // Hide logout link
            document.getElementById('logoutNavItem').style.display = 'none';
        }
    }
        
    // Function to handle logout
    function logout() {
        // Clear user data from localStorage
        localStorage.removeItem('userToken');
        localStorage.removeItem('userName');
        localStorage.removeItem('userRole');
        
        // Update navigation after logout
        checkAuth();
        
        // Redirect to home page
        window.location.href = 'index.html';
    }
        
    // Function to check if user is authorized to download
    function checkDownloadAuth(event) {
        // Get authentication data from localStorage
        const token = localStorage.getItem('userToken');
        
        if (!token) {
            // User is not logged in
            event.preventDefault();
            alert('Please log in to download this newspaper.');
            // Redirect to login page after a short delay
            setTimeout(function() {
                window.location.href = 'login.html';
            }, 1000);
            return false;
        }
        return true;
    }
    </script>

    <!-- Bootstrap JS and dependencies -->
    <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.5.3/dist/umd/popper.min.js"></script>
    <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.0/js/bootstrap.min.js"></script>
</body>
</html>
    `;
}



// Music upload route
app.post('/upload-music', upload.fields([
    { name: 'audioFile', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 }
]), async (req, res) => {
    try {
        const musicData = {
            id: Date.now().toString(),
            title: req.body.title,
            artist: req.body.artist,
            featuredArtists: JSON.parse(req.body.featuredArtists || '[]'),
            album: req.body.album,
            year: req.body.year,
            coverImage: req.files['coverImage'] ? `/uploads/${req.files['coverImage'][0].filename}` : '',
            audioFile: req.files['audioFile'] ? `/uploads/${req.files['audioFile'][0].filename}` : '',
            genres: JSON.parse(req.body.genres || '[]'),
            description: req.body.description,
            explicit: req.body.explicit === 'true'
        };

        // Generate HTML content for the music page
        const htmlContent = generateMusicPage(musicData);

        // Ensure music directory exists
        const musicDir = path.join(__dirname, 'public', 'music');
        if (!fs.existsSync(musicDir)){
            fs.mkdirSync(musicDir);
        }

        // Generate unique filename
        const filename = `music_${musicData.id}.html`;
        const outputPath = path.join(musicDir, filename);

        // Save generated HTML
        fs.writeFileSync(outputPath, htmlContent);

        // Add HTML link to music data
        musicData.htmlLink = `/music/${filename}`;

        // Create music in database
        await Music.create(musicData);

        // Respond with HTML content
        res.send(htmlContent);
    } catch (error) {
        console.error('Error uploading music:', error);
        res.status(500).send('Error uploading music');
    }
});

// Route to get all music
app.get('/music', async (req, res) => {
    try {
        const musicItems = await Music.findAll();
        res.json(musicItems);
    } catch (error) {
        console.error('Error fetching music:', error);
        res.status(500).json({ error: 'Unable to fetch music' });
    }
});

// Route to get a specific music by ID
app.get('/music/:id', async (req, res) => {
    try {
        const musicItem = await Music.findByPk(req.params.id);
        if (musicItem) {
            res.json(musicItem);
        } else {
            res.status(404).json({ error: 'Music not found' });
        }
    } catch (error) {
        console.error('Error fetching music:', error);
        res.status(500).json({ error: 'Unable to fetch music' });
    }
});

// Music page generation function
function generateMusicPage(data) {
    const featuredArtistsList = data.featuredArtists.length > 0 
        ? `<p><strong>Featured Artists:</strong> ${data.featuredArtists.join(', ')}</p>`
        : '';
    
    const genresList = data.genres.length > 0
        ? `<div class="mb-3">${data.genres.map(genre => `<span class="badge badge-pill genre-badge">${genre}</span>`).join('')}</div>`
        : '';

    const explicitBadge = data.explicit 
        ? '<span class="badge badge-danger">EXPLICIT</span>'
        : '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.title} - The Multimedia Store</title>
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.0/css/bootstrap.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css">
    <style>
        body {
            font-family: 'Nanum Myeongjo', serif;
            background-color: #f8f9fa;
        }
        .jumbotron {
            background-image: linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url("${data.coverImage || '/img/default-music.jpg'}");
            background-size: cover;
            background-position: center;
            color: white;
        }
        .music-player-container {
            background-color: white;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .genre-badge {
            background-color: #e2d1f9;
            color: #6a1b9a;
            margin-right: 5px;
        }
        .music-cover {
            width: 100%;
            max-width: 400px;
            border-radius: 5px;
        }
        .download-btn {
            background-color: #28a745;
            color: white;
            border-radius: 5px;
            padding: 8px 20px;
            text-decoration: none;
            display: inline-block;
            transition: background-color 0.3s;
            margin-top: 15px;
        }
        .download-btn:hover {
            background-color: #218838;
            color: white;
            text-decoration: none;
        }
        .player-controls {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
    </style>
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
        <a class="navbar-brand" href="/">THE MULTIMEDIA STORE</a>
        <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarNav">
            <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
            <ul class="navbar-nav ml-auto">
                <li class="nav-item">
                    <a class="nav-link" href="/index.html">Home</a>
                </li>
                <li class="nav-item" id="loginNavItem">
                    <a class="nav-link" href="/login.html">Login</a>
                </li>
                <li class="nav-item" id="registerNavItem">
                    <a class="nav-link" href="/register.html">Register</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="/contact.html">Contact</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="/about.html">About</a>
                </li>
                <li class="nav-item" id="logoutNavItem" style="display:none;">
                    <a class="nav-link" href="#" onclick="logout()">Logout</a>
                </li>
            </ul>
        </div>
    </nav>

    <div class="jumbotron text-center">
        <div class="container">
            <h1 class="display-4">${data.title} ${explicitBadge}</h1>
            <p class="lead">By ${data.artist}</p>
            ${data.album ? `<p>From the album: <strong>${data.album}</strong></p>` : ''}
        </div>
    </div>

    <div class="container my-5">
        <div class="row">
            <div class="col-md-4 text-center">
                <img src="${data.coverImage || '/img/default-music.jpg'}" alt="${data.title} Cover" class="img-fluid music-cover mb-4">
                ${genresList}
            </div>
            <div class="col-md-8">
                <div class="music-player-container">
                    <h3>${data.title}</h3>
                    <p class="text-muted">${data.artist} • ${data.year}</p>
                    ${featuredArtistsList}
                    
                    <div class="mt-4 player-controls">
                        <audio controls class="w-100">
                            <source src="${data.audioFile}" type="audio/mpeg">
                            Your browser does not support the audio element.
                        </audio>
                        
                        <a href="${data.audioFile}" download="${data.artist} - ${data.title}.mp3" class="download-btn" onclick="return checkDownloadAuth(event)">
                            <i class="fas fa-download mr-2"></i>Download MP3
                        </a>
                    </div>
                    
                    ${data.description ? `<div class="mt-4"><p>${data.description}</p></div>` : ''}
                </div>
            </div>
        </div>
    </div>

    <footer class="bg-dark text-white text-center py-4 mt-5">
        <p>&copy; 2025 THE MULTIMEDIA STORE. All rights reserved.</p>
    </footer>

    <script>
    // Check authentication status when the page loads
    document.addEventListener('DOMContentLoaded', function() {
        checkAuth();
    });

    function checkAuth() {
        // Get authentication data from localStorage
        const token = localStorage.getItem('userToken');
        
        if (token) {
            // User is logged in
            // Hide login and register links
            document.getElementById('loginNavItem').style.display = 'none';
            document.getElementById('registerNavItem').style.display = 'none';
            // Show logout link
            document.getElementById('logoutNavItem').style.display = 'block';
        } else {
            // User is not logged in
            // Show login and register links
            document.getElementById('loginNavItem').style.display = 'block';
            document.getElementById('registerNavItem').style.display = 'block';
            // Hide logout link
            document.getElementById('logoutNavItem').style.display = 'none';
        }
    }
        
    // Function to handle logout
    function logout() {
        // Clear user data from localStorage
        localStorage.removeItem('userToken');
        localStorage.removeItem('userName');
        localStorage.removeItem('userRole');
        
        // Update navigation after logout
        checkAuth();
        
        // Redirect to home page
        window.location.href = 'index.html';
    }
        
    // Function to check if user is authorized to download
    function checkDownloadAuth(event) {
        // Get authentication data from localStorage
        const token = localStorage.getItem('userToken');
        
        if (!token) {
            // User is not logged in
            event.preventDefault();
            alert('Please log in to download this audio file.');
            // Redirect to login page after a short delay
            setTimeout(function() {
                window.location.href = 'login.html';
            }, 1000);
            return false;
        }
        return true;
    }
    </script>

    <!-- Bootstrap JS and dependencies -->
    <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.5.3/dist/umd/popper.min.js"></script>
    <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.0/js/bootstrap.min.js"></script>
</body>
</html>
    `;
}


// Newspaper upload route with HTML generation
app.post('/upload-newspaper', newspaperUpload.fields([
    { name: 'frontPageImage', maxCount: 1 },
    { name: 'newspaperPdf', maxCount: 1 }
]), async (req, res) => {
    try {
        // Process uploaded files
        const coverImage = req.files['frontPageImage'] ? 
            `/uploads/newspapers/${req.files['frontPageImage'][0].filename}` : '';
        const pdfPath = `/uploads/newspapers/${req.files['newspaperPdf'][0].filename}`;

        // Process keywords
        const keywords = req.body.keywords ? 
            req.body.keywords.split(',').map(k => k.trim()).filter(k => k) : [];

        // Create newspaper data
        const newspaperData = {
            id: Date.now().toString(),
            name: req.body.newspaperName,
            publishDate: req.body.publishDate,
            editionType: req.body.editionType,
            description: req.body.archiveDescription,
            coverImage: coverImage,
            pdfPath: pdfPath,
            keywords: keywords
        };

        // Generate HTML content
        const htmlContent = generateNewspaperPage(newspaperData);

        // Ensure newspapers directory exists
        const newspapersDir = path.join(__dirname, 'public', 'newspapers');
        if (!fs.existsSync(newspapersDir)){
            fs.mkdirSync(newspapersDir, { recursive: true });
        }

        // Generate unique filename
        const filename = `newspaper_${newspaperData.id}.html`;
        const outputPath = path.join(newspapersDir, filename);

        // Save generated HTML
        fs.writeFileSync(outputPath, htmlContent);

        // Add HTML link to newspaper data
        newspaperData.htmlLink = `/newspapers/${filename}`;

        // Create newspaper in database
        await Newspaper.create(newspaperData);

        // Respond with success
        res.json({ 
            success: true, 
            newspaper: newspaperData,
            htmlLink: newspaperData.htmlLink
        });
    } catch (error) {
        console.error('Error uploading newspaper:', error);
        res.status(500).json({ error: 'Error uploading newspaper', details: error.message });
    }
});

// Route to get all newspapers
app.get('/newspapers', async (req, res) => {
    try {
        const newspapers = await Newspaper.findAll({
            order: [['publishDate', 'DESC']]
        });
        res.json(newspapers);
    } catch (error) {
        console.error('Error fetching newspapers:', error);
        res.status(500).json({ error: 'Unable to fetch newspapers' });
    }
});

// Route to get newspapers filtered by year and edition
app.get('/newspapers/filter', async (req, res) => {
    try {
        const { year, edition } = req.query;
        
        let whereClause = {};
        
        if (year) {
            whereClause.publishDate = {
                [Op.and]: [
                    sequelize.where(sequelize.fn('YEAR', sequelize.col('publishDate')), year)
                ]
            };
        }
        
        if (edition) {
            whereClause.editionType = edition;
        }
        
        const newspapers = await Newspaper.findAll({
            where: whereClause,
            order: [['publishDate', 'DESC']]
        });
        
        res.json(newspapers);
    } catch (error) {
        console.error('Error filtering newspapers:', error);
        res.status(500).json({ error: 'Unable to filter newspapers' });
    }
});

// Route to get a specific newspaper by ID
app.get('/newspapers/:id', async (req, res) => {
    try {
        const newspaper = await Newspaper.findByPk(req.params.id);
        if (newspaper) {
            res.json(newspaper);
        } else {
            res.status(404).json({ error: 'Newspaper not found' });
        }
    } catch (error) {
        console.error('Error fetching newspaper:', error);
        res.status(500).json({ error: 'Unable to fetch newspaper' });
    }
});

// Route to serve generated newspaper HTML pages
app.get('/newspapers/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'newspapers', req.params.filename);
    res.sendFile(filePath);
});

// Explicitly serve HTML pages with correct Content-Type
app.get('/:page.html', (req, res) => {
    const page = req.params.page;
    const filePath = path.join(__dirname, 'public', `${page}.html`);
    
    // Check if the file exists
    if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'text/html');
        res.sendFile(filePath);
    } else {
        res.status(404).send('Page not found');
    }
});

// Configure multer for multiple file uploads
const articleUpload = multer({ 
    storage: storage,  
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Serve static pages (keep existing implementation)
const staticPages = ['index', 'login', 'register', 'contact', 'about', 'form','newspaper-form', 'newspaper-list', 'aeticle-form.html' , 'article-list.html', 'book-list.html', 'game-form.html', 'game-list.html', 'newspaper-form.html', 'newspaper-list.html', 'painting-form.html', 'painting-list.html', 'video-list.html', 'videos-form.html'];
staticPages.forEach(page => {
    app.get(`/${page}.html`, (req, res) => {
        res.sendFile(path.join(__dirname, 'public', `${page}.html`));
    });
});

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    try {
        await sequelize.close();
        console.log('Database connection closed.');
        process.exit(0);
    } catch (error) {
        console.error('Error closing database connection:', error);
        process.exit(1);
    }
});
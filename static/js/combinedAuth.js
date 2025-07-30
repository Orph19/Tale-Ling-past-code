document.addEventListener('DOMContentLoaded', () => {
    // Selector Tabs (buttons at the top)
    const showSignInTab = document.getElementById('showSignInTab');
    const showSignUpTab = document.getElementById('showSignUpTab');

    // Content areas for each form
    const signInContent = document.getElementById('signInContent');
    const signUpContent = document.getElementById('signUpContent');

    // Elements for Sign In Form
    const emailInputSignIn = document.getElementById('emailInputSignIn');
    const passwordInputSignIn = document.getElementById('passwordInputSignIn');
    const signInButton = document.getElementById('signInButton');
    const messageDivSignIn = document.getElementById('messageDivSignIn');
    const messageElementSignIn = document.createElement('p'); // Create message element once
    messageDivSignIn.appendChild(messageElementSignIn); // Append to message div

    const togglePasswordButtonSignIn = document.getElementById('togglePasswordSignIn');
    const eyeOpenSignIn = document.getElementById('eyeOpenSignIn');
    const eyeClosedSignIn = document.getElementById('eyeClosedSignIn');

    // Elements for Sign Up Form
    const emailInputSignUp = document.getElementById('emailInputSignUp');
    const passwordInputSignUp = document.getElementById('passwordInputSignUp');
    const signUpButton = document.getElementById('signUpButton');
    const messageDivSignUp = document.getElementById('messageDivSignUp');
    const messageElementSignUp = document.createElement('p'); // Create message element once
    messageDivSignUp.appendChild(messageElementSignUp); // Append to message div

    const togglePasswordButtonSignUp = document.getElementById('togglePasswordSignUp');
    const eyeOpenSignUp = document.getElementById('eyeOpenSignUp');
    const eyeClosedSignUp = document.getElementById('eyeClosedSignUp');

    // Function to display messages
    function displayMessage(messageDiv, messageElement, text, type = 'info') {
        messageElement.textContent = text;
        messageDiv.className = 'messageDiv'; // Reset classes
        if (type === 'success') {
            messageDiv.classList.add('message-success');
        } else if (type === 'error') {
            messageDiv.classList.add('message-error');
        } else {
            messageDiv.classList.add('message-info');
        }
    }

    // Function to clear messages after a delay
    function clearMessageWithDelay(messageDiv, messageElement, delay = 2500) {
        setTimeout(() => {
            messageElement.textContent = '';
            messageDiv.className = 'messageDiv'; // Remove all message type classes
        }, delay);
    }

    // Async function to handle the sign-in logic
    async function handleSignIn() {
        const email = emailInputSignIn.value.trim();
        const password = passwordInputSignIn.value.trim();

        // Input validation
        if (!email) {
            displayMessage(messageDivSignIn, messageElementSignIn, 'Please enter your email.', 'error');
            emailInputSignIn.focus();
            clearMessageWithDelay(messageDivSignIn, messageElementSignIn, 4000);
            return;
        }
        if (!password) {
            displayMessage(messageDivSignIn, messageElementSignIn, 'Please enter your password.', 'error');
            passwordInputSignIn.focus();
            clearMessageWithDelay(messageDivSignIn, messageElementSignIn, 4000);
            return;
        }

        // Disable button and show loading message
        signInButton.disabled = true;
        displayMessage(messageDivSignIn, messageElementSignIn, 'Signing in...', 'info');

        try {
            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            };

            const signInResponse = await fetch('/api/signIn', options);

            if (!signInResponse.ok) {
                let errorDetails;
                try {
                    errorDetails = await signInResponse.json();
                } catch (parseError) {
                    errorDetails = await signInResponse.text();
                }

                const errorMessage = errorDetails.message || errorDetails.error || (typeof errorDetails === 'string' ? errorDetails : 'An unknown error occurred.');
                console.error('Backend Sign-In Error:', signInResponse.status, errorMessage);
                displayMessage(messageDivSignIn, messageElementSignIn, `Sign-In Failed: ${errorMessage}`, 'error');
                clearMessageWithDelay(messageDivSignIn, messageElementSignIn, 5000);
            } else {
                const signInData = await signInResponse.json();
                displayMessage(messageDivSignIn, messageElementSignIn, signInData.message || 'Successfully Signed In!', 'success');
                
                emailInputSignIn.value = '';
                passwordInputSignIn.value = '';
                emailInputSignIn.focus();
                clearMessageWithDelay(messageDivSignIn, messageElementSignIn);
                window.history.back();
            }
        } catch (error) {
            console.error('Network or unexpected error during sign-in:', error);
            displayMessage(messageDivSignIn, messageElementSignIn, `Network Error: ${error.message || 'Could not connect to the server. Please check your internet connection and try again.'}`, 'error');
            clearMessageWithDelay(messageDivSignIn, messageElementSignIn, 5000);
        } finally {
            signInButton.disabled = false;
        }
    }

    // Async function to handle the sign-up logic
    async function handleSignUp() {
        const email = emailInputSignUp.value.trim();
        const password = passwordInputSignUp.value.trim();

        // Input validation
        if (!email) {
            displayMessage(messageDivSignUp, messageElementSignUp, 'Please enter your email.', 'error');
            emailInputSignUp.focus(); 
            clearMessageWithDelay(messageDivSignUp, messageElementSignUp, 4000); 
            return; 
        }
        if (!password) {
            displayMessage(messageDivSignUp, messageElementSignUp, 'Please enter your password.', 'error');
            passwordInputSignUp.focus(); 
            clearMessageWithDelay(messageDivSignUp, messageElementSignUp, 4000); 
            return;
        }

        // Disable button and show loading message
        signUpButton.disabled = true;
        displayMessage(messageDivSignUp, messageElementSignUp, 'Signing up...', 'info');

        try {
            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            };

            const signUpResponse = await fetch('/api/signUp', options);

            if (!signUpResponse.ok) {
                let errorDetails;
                try {
                    errorDetails = await signUpResponse.json();
                } catch (parseError) {
                    errorDetails = await signUpResponse.text();
                }

                const errorMessage = errorDetails.message || errorDetails.error || (typeof errorDetails === 'string' ? errorDetails : 'An unknown error occurred.');
                console.error('Backend Sign-Up Error:', signUpResponse.status, errorMessage);
                displayMessage(messageDivSignUp, messageElementSignUp, `Sign-Up Failed: ${errorMessage}`, 'error');
                clearMessageWithDelay(messageDivSignUp, messageElementSignUp, 5000);

            } else {
                const signUpData = await signUpResponse.json();
                console.log('Sign-Up Success:', signUpData);
                displayMessage(messageDivSignUp, messageElementSignUp, signUpData.message || 'Successfully Signed Up!', 'success');
                
                emailInputSignUp.value = '';
                passwordInputSignUp.value = '';
                emailInputSignUp.focus();
                clearMessageWithDelay(messageDivSignUp, messageElementSignUp);
                window.location.replace('/');
            }
        } catch (error) {
            console.error('Network or unexpected error during sign-up:', error);
            displayMessage(messageDivSignUp, messageElementSignUp, `Network Error: ${error.message || 'Could not connect to the server. Please check your internet connection and try again.'}`, 'error');
            clearMessageWithDelay(messageDivSignUp, messageElementSignUp, 6000);
        } finally {
            signUpButton.disabled = false;
        }
    }

    // Function to set the active form content and tab
    function setActiveTab(tabId) {
        if (tabId === 'signIn') {
            showSignInTab.classList.add('active');
            showSignUpTab.classList.remove('active');
            signInContent.classList.remove('hidden');
            signUpContent.classList.add('hidden');

            // Enable sign-in inputs, disable sign-up inputs
            emailInputSignIn.disabled = false;
            passwordInputSignIn.disabled = false;
            signInButton.disabled = false;

            emailInputSignUp.disabled = true;
            passwordInputSignUp.disabled = true;
            signUpButton.disabled = true;

            emailInputSignIn.focus();
            clearMessageWithDelay(messageDivSignUp, messageElementSignUp, 0); // Clear sign-up messages
        } else {
            showSignUpTab.classList.add('active');
            showSignInTab.classList.remove('active');
            signUpContent.classList.remove('hidden');
            signInContent.classList.add('hidden');

            // Enable sign-up inputs, disable sign-in inputs
            emailInputSignUp.disabled = false;
            passwordInputSignUp.disabled = false;
            signUpButton.disabled = false;

            emailInputSignIn.disabled = true;
            passwordInputSignIn.disabled = true;
            signInButton.disabled = true;

            emailInputSignUp.focus();
            clearMessageWithDelay(messageDivSignIn, messageElementSignIn, 0); // Clear sign-in messages
        }
    }

    // Event Listeners for selector tabs
    showSignInTab.addEventListener('click', () => setActiveTab('signIn'));
    showSignUpTab.addEventListener('click', () => setActiveTab('signUp'));

    // Event Listeners for Sign In Form
    signInButton?.addEventListener('click', handleSignIn);

    emailInputSignIn.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            if (emailInputSignIn.value.trim()) {
                 passwordInputSignIn.focus();
            } else {
                handleSignIn();
            }
        }
    });

    passwordInputSignIn.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleSignIn();
        }
    });

    togglePasswordButtonSignIn.addEventListener('click', () => {
        const type = passwordInputSignIn.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInputSignIn.setAttribute('type', type);

        eyeOpenSignIn.classList.toggle('hidden');
        eyeClosedSignIn.classList.toggle('hidden');
    });

    // Event Listeners for Sign Up Form
    signUpButton?.addEventListener('click', handleSignUp);

    emailInputSignUp.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            if (emailInputSignUp.value.trim()) {
                 passwordInputSignUp.focus();
            } else {
                handleSignUp();
            }
        }
    });

    passwordInputSignUp.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleSignUp();
        }
    });

    togglePasswordButtonSignUp.addEventListener('click', () => {
        const type = passwordInputSignUp.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInputSignUp.setAttribute('type', type);

        eyeOpenSignUp.classList.toggle('hidden');
        eyeClosedSignUp.classList.toggle('hidden');
    });

    // Initialize: set Sign In as the active form by default
    setActiveTab('signIn');
});

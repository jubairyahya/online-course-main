const { createApp, ref, computed, onMounted } = Vue;

createApp({
  setup() {
    // ----------------- State -----------------
    const currentPage = ref('home');
    const lessons = ref([]);
    const cart = ref([]);
    const searchQuery = ref('');
    const sortField = ref('');
    const sortOrder = ref('asc');

    // Admin
    const username = ref('');
    const password = ref('');
    const loggedIn = ref(false);
    const adminKey = ref('');

    // Lesson form (admin)
    const topic = ref('');
    const location = ref('');
    const price = ref(0);
    const space = ref(0);
    const imageFile = ref(null);

    // Checkout form
    const firstName = ref('');
    const lastName = ref('');
    const address = ref('');
    const city = ref('');
    const country = ref('');
    const countries = ref([
      "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Argentina", "Armenia",
      "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados",
      "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina",
      "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cambodia",
      "Cameroon", "Canada", "Cape Verde", "Central African Republic", "Chad", "Chile",
      "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus",
      "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador",
      "Egypt", "El Salvador", "Estonia", "Ethiopia", "Fiji", "Finland", "France", "Gabon",
      "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea",
      "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran",
      "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan",
      "Kenya", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia",
      "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi",
      "Malaysia", "Maldives", "Mali", "Malta", "Mauritania", "Mauritius", "Mexico",
      "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar",
      "Namibia", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria",
      "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palestine", "Panama",
      "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar",
      "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Samoa",
      "San Marino", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone",
      "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa",
      "South Korea", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland",
      "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Togo", "Tonga",
      "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Uganda", "Ukraine",
      "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan",
      "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
    ]);

    const postcode = ref('');
    const phone = ref('');
    const email = ref('');
    // Payment fields
    const paymentMethod = ref('card'); // default
    const cardType = ref('');
    const cardNumber = ref('');
    const cardName = ref('');
    const cardExpiry = ref(''); // MM/YY
    const cardCVV = ref('');
    const cardError = ref('');

    // ----------------- Computed -----------------
    const totalItems = computed(() =>
      cart.value.reduce((sum, i) => sum + i.quantity, 0)
    );

    const totalPrice = computed(() =>
      cart.value.reduce((sum, i) => sum + i.price * i.quantity, 0)
    );

    const validForm = computed(() => {
      return (
        /^[A-Za-z ]+$/.test(firstName.value) &&
        /^[A-Za-z ]+$/.test(lastName.value) &&
        address.value.trim().length > 0 &&
        city.value.trim().length > 0 &&
        postcode.value.trim().length > 0 &&
        /^[0-9]+$/.test(phone.value) &&
        country.value.trim().length > 0
      );
      if (paymentMethod.value === 'paypal') {
        // For PayPal we can require an email
        return basic && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value);
      }

      // Card payment validation
      const rawCardDigits = (cardNumber.value || '').replace(/\D/g, '');
      const cardOk = rawCardDigits.length >= 13 && rawCardDigits.length <= 19 && luhnCheck(rawCardDigits);
      const nameOk = cardName.value.trim().length > 0;
      const expiryOk = validateExpiry(cardExpiry.value);
      const cvvOk = /^[0-9]{3,4}$/.test(cardCVV.value);

      return basic && cardOk && nameOk && expiryOk && cvvOk;
    });


    // ----------------- Lessons -----------------
    async function fetchLessons(skipPageChange = false) {
      try {
        let url = 'http://localhost:5000/lessons';
        if (searchQuery.value)
          url = `http://localhost:5000/search?q=${encodeURIComponent(searchQuery.value)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to load lessons');
        lessons.value = await res.json();
        sortLessons();
        if (!skipPageChange) currentPage.value = currentPage.value;
      } catch (err) {
        console.error('Failed to fetch lessons:', err);
      }
    }

    function sortLessons() {
      if (!sortField.value) return;
      lessons.value.sort((a, b) => {
        let aVal = a[sortField.value];
        let bVal = b[sortField.value];
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();
        if (aVal < bVal) return sortOrder.value === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortOrder.value === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // ----------------- Cart -----------------
    function addToCart(lesson) {
      if (lesson.space <= 0) return;
      const existing = cart.value.find(i => i._id === lesson._id);
      if (existing) existing.quantity += 1;
      else cart.value.push({ ...lesson, quantity: 1 });

      // Decrease availability in UI
      const targetLesson = lessons.value.find(l => l._id === lesson._id);
      if (targetLesson) targetLesson.space -= 1;
    }

    function removeFromCart(lessonId) {
      const removed = cart.value.find(i => i._id === lessonId);
      if (removed) {
        const lessonInList = lessons.value.find(l => l._id === lessonId);
        if (lessonInList) lessonInList.space += removed.quantity;
      }
      cart.value = cart.value.filter(i => i._id !== lessonId);
    }
    //card function
    // Format card number with spaces while typing
    function onCardNumberInput(e) {
      // remove non-digits
      let v = e.target.value.replace(/\D/g, '');
      // detect card type automatically
      const detected = detectCardType(v);
      if (!cardType.value) cardType.value = detected || '';

      // insert spaces: typical groups 4-4-4-4 or Amex 4-6-5
      if (detected === 'amex') {
        v = v.replace(/^(\d{4})(\d{6})(\d{0,5}).*/, '$1 $2 $3').trim();
      } else {
        v = v.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
      }
      cardNumber.value = v;
    }

    // expiry formatting MM/YY
    function onExpiryInput(e) {
      let v = e.target.value.replace(/\D/g, '').slice(0, 4);
      if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
      cardExpiry.value = v;
    }

    // CVV allow digits only
    function onCvvInput(e) {
      cardCVV.value = e.target.value.replace(/\D/g, '').slice(0, 4);
    }

    // detect card type by BIN
    function detectCardType(digits) {
      if (!digits) return '';
      if (/^4/.test(digits)) return 'visa';
      if (/^5[1-5]/.test(digits) || /^2(2[2-9]|[3-6]\d|7[01])/.test(digits)) return 'mastercard';
      if (/^3[47]/.test(digits)) return 'amex';
      if (/^6(?:011|5)/.test(digits)) return 'discover';
      return '';
    }

    // Luhn algorithm for basic card validation
    function luhnCheck(cardNum) {
      const digits = cardNum.replace(/\D/g, '');
      let sum = 0;
      let toggle = false;
      for (let i = digits.length - 1; i >= 0; i--) {
        let d = parseInt(digits.charAt(i), 10);
        if (toggle) {
          d *= 2;
          if (d > 9) d -= 9;
        }
        sum += d;
        toggle = !toggle;
      }
      return sum % 10 === 0;
    }

    function validateExpiry(exp) {
      if (!/^\d{2}\/\d{2}$/.test(exp)) return false;
      const [mmStr, yyStr] = exp.split('/');
      const mm = parseInt(mmStr, 10);
      const yy = parseInt(yyStr, 10);
      if (mm < 1 || mm > 12) return false;
      // convert to 20YY (assumes 2000-2099)
      const expiry = new Date(2000 + yy, mm - 1, 1);
      const now = new Date();
      // set to end of month
      expiry.setMonth(expiry.getMonth() + 1);
      expiry.setDate(0); // last day of month
      return expiry >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }


    // ----------------- Checkout -----------------
    async function checkout() {
      try {
        if (!validForm.value) {
          alert('Please fill all checkout fields.');
          return;
        }

        if (paymentMethod.value === 'card') {
          // Basic client-side checks
          const digits = cardNumber.value.replace(/\D/g, '');
          if (!luhnCheck(digits)) {
            cardError.value = 'Invalid card number';
            return;
          }
          if (!validateExpiry(cardExpiry.value)) {
            cardError.value = 'Card expired';
            return;
          }
          if (!/^[0-9]{3,4}$/.test(cardCVV.value)) {
            cardError.value = 'Invalid CVV';
            return;
          }

          cardError.value = '';
          const order = {
            firstName: firstName.value,
            lastName: lastName.value,
            address: address.value,
            city: city.value,
            country: country.value,
            postcode: postcode.value,
            phone: phone.value,
            email: email.value,
            lessonIDs: cart.value.map(i => i._id),
            quantities: cart.value.map(i => i.quantity),
            paymentMethod: 'card',
            cardLast4: digits.slice(-4),
            cardBrand: cardType.value || detectCardType(digits) || 'unknown'
          };

          const res = await fetch('http://localhost:5000/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(order),
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.message || 'Order failed');

          alert(`Payment & Order confirmed. Charged card ending ${order.cardLast4}`);
        } else if (paymentMethod.value === 'paypal') {
          // Redirect to PayPal flow or open checkout
          // For now simulate:
          alert('Redirecting to PayPal (simulated).');
        }
        // Reset
        cart.value = [];
        firstName.value = '';
        lastName.value = '';
        address.value = '';
        city.value = '';
        country.value = '';
        postcode.value = '';
        phone.value = '';
        email.value = '';
        paymentMethod.value = 'card';
        cardType.value = '';
        cardNumber.value = '';
        cardName.value = '';
        cardExpiry.value = '';
        cardCVV.value = '';
        cardError.value = '';
        currentPage.value = 'home';
        fetchLessons();
      } catch (err) {
        console.error('Checkout error:', err);
        alert('Failed to place order: ' + err.message);
      }
    }

    // ----------------- Admin -----------------
    // ----------------- Admin -----------------
    async function login() {
      try {
        const res = await fetch('http://localhost:5000/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username.value,
            password: password.value,
          }),
        });

        if (!res.ok) {
          alert('Invalid credentials');
          return;
        }

        const data = await res.json();
        adminKey.value = data.adminKey;
        loggedIn.value = true;
        alert('Login successful!');
        currentPage.value = 'admin'; // Stay on admin page after login
      } catch (err) {
        console.error('Login error:', err);
        alert('Login failed.');
      }
    }

    function logout() {
      // clear admin info and return to home
      loggedIn.value = false;
      adminKey.value = '';
      username.value = '';
      password.value = '';
      alert('Logged out successfully!');
      currentPage.value = 'admin';
    }

    function onFileChange(event) {
      imageFile.value = event.target.files[0];
    }

    async function addLesson() {
      try {
        if (!topic.value || !location.value || !price.value || !space.value || !imageFile.value) {
          alert('Please fill all fields and select an image.');
          return;
        }

        const formData = new FormData();
        formData.append('topic', topic.value);
        formData.append('location', location.value);
        formData.append('price', price.value);
        formData.append('space', space.value);
        formData.append('image', imageFile.value);

        const res = await fetch('http://localhost:5000/admin/lessons', {
          method: 'POST',
          headers: { 'x-admin-key': adminKey.value },
          body: formData,
        });

        const text = await res.text();
        if (!res.ok) throw new Error(`Server returned ${res.status}: ${text}`);

        let data;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error('Server did not return valid JSON.');
        }

        alert(data.message || 'Lesson added successfully!');

        //  Clear input fields
        topic.value = '';
        location.value = '';
        price.value = '';
        space.value = '';
        imageFile.value = null;

        await fetchLessons();
        currentPage.value = 'admin';


      } catch (err) {
        console.error('Error adding lesson:', err);
        alert('Failed to add lesson. Check console for details.');
      }
    }
    
   
async function deleteLesson(id) {
  if (!confirm("Are you sure you want to delete this lesson?")) return;

  try {
    const res = await fetch(`http://localhost:5000/lessons/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-key': adminKey.value },
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } 
    catch { throw new Error("Server did not return JSON: " + text); }

    alert(data.message || "Lesson deleted successfully");
    fetchLessons();
  } catch (err) {
    console.error("Failed to delete lesson:", err);
    alert("Error deleting lesson: " + err.message);
  }
}

    async function editLesson(lesson) {
      const newTopic = prompt("Enter new topic:", lesson.topic);
      const newLocation = prompt("Enter new location:", lesson.location);
      const newPrice = prompt("Enter new price:", lesson.price);
      const newSpace = prompt("Enter new spaces:", lesson.space);

      if (!newTopic || !newLocation || !newPrice || !newSpace) {
        alert("All fields are required.");
        return;
      }

      try {
        const res = await fetch(`http://localhost:5000/lessons/${lesson._id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey.value,
          },
          body: JSON.stringify({
            topic: newTopic,
            location: newLocation,
            price: Number(newPrice),
            space: Number(newSpace),
          }),
        });

        const data = await res.json();
        alert(data.message);
        fetchLessons();
      } catch (err) {
        console.error("Failed to update lesson:", err);
        alert("Error updating lesson");
      }
    }



    // ----------------- Init -----------------
    onMounted(fetchLessons);

    return {
      currentPage,
      lessons,
      cart,
      searchQuery,
      sortField,
      sortOrder,
      username,
      password,
      loggedIn,
      adminKey,
      topic,
      location,
      price,
      space,
      imageFile,
      firstName,
      lastName,
      address,
      city,
      country,
      countries,
      postcode,
      phone,
      email,
      paymentMethod,
      cardType,
      cardNumber,
      cardName,
      cardExpiry,
      cardCVV,
      cardError,
      onCardNumberInput,
      onExpiryInput,
      onCvvInput,
      detectCardType,
      totalItems,
      totalPrice,
      validForm,
      fetchLessons,
      sortLessons,
      addToCart,
      removeFromCart,
      checkout,
      login,
      logout,
      onFileChange,
      addLesson,
      editLesson,
      deleteLesson,
    };
  },
}).mount('#app');

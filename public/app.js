document.addEventListener('DOMContentLoaded', function() {
    // --- Get all DOM elements ---
    const loginView = document.getElementById('login-view');
    const appView = document.getElementById('app-view');
    const loginButton = document.getElementById('login-btn');
    const logoutButton = document.getElementById('logout-btn');
    const submitButton = document.getElementById('submit-btn');
    const fileInput = document.getElementById('file-input');
    const customerEmailInput = document.getElementById('customer-email-input');
    const manualTotalPriceDisplay = document.getElementById('manual-total-price');

    // Analysis and results areas
    const analysisMessage = document.getElementById('analysis-message');
    const analysisResults = document.getElementById('analysis-results');
    const fileNameDisplay = document.getElementById('file-name');
    const wordCountDisplay = document.getElementById('word-count');
    const pageCountDisplay = document.getElementById('page-count');

    // Service, Delivery, and Upload options
    const serviceRephrasing = document.getElementById('service-rephrasing');
    const serviceTranslation = document.getElementById('service-translation');
    const serviceTypeCheckboxes = document.querySelectorAll('input[name="serviceType"]');
    const globalUploadBtn = document.getElementById('global-upload-btn');

    // Shared Delivery Options
    const deliveryOptionsShared = document.getElementById('delivery-options-shared');
    const sharedDeliveryRadios = document.querySelectorAll('input[name="deliveryTime"]');
    const labelDeliveryNormal = document.getElementById('label-delivery-normal');
    const labelDeliveryFast = document.getElementById('label-delivery-fast');

    // --- State ---
    let currentFile = null;
    let currentPageCount = 0;

    // --- Pricing Map ---
    const pricing = {
        rephrasing: { normal: 5, fast: 10 },
        translation: { normal: 7, fast: 10 }
    };

    // --- Main Functions ---
    function showAppView() {
        loginView.classList.add('hidden');
        appView.classList.remove('hidden');
        resetForm();
    }

    function showLoginView() {
        appView.classList.add('hidden');
        loginView.classList.remove('hidden');
        resetForm();
    }

    async function processFile(file) {
        if (!file) return;
        currentFile = file; 
        fileNameDisplay.textContent = file.name;
        analysisMessage.textContent = 'جاري تحليل المستند...';
        analysisMessage.classList.remove('hidden');
        analysisResults.classList.add('hidden');

        const formData = new FormData();
        formData.append('document', file);

        try {
            const response = await fetch('/analyze-document', { method: 'POST', body: formData });
            if (!response.ok) {
                const errorResult = await response.json();
                throw new Error(errorResult.message || 'فشل تحليل المستند.');
            }
            const result = await response.json();
            handleAnalysisResult(result);
        } catch (error) {
            console.error('Error:', error);
            analysisMessage.textContent = `خطأ: ${error.message}`;
        }
    }

    function handleAnalysisResult({ wordCount, pageCount }) {
        currentPageCount = pageCount;
        analysisMessage.classList.add('hidden');
        wordCountDisplay.textContent = wordCount;
        pageCountDisplay.textContent = pageCount;
        analysisResults.classList.remove('hidden');
        calculatePrice();
    }

    function updateSharedDeliveryOptions() {
        let priceNormal = 0;
        let priceFast = 0;

        if (serviceRephrasing.checked) {
            priceNormal += pricing.rephrasing.normal;
            priceFast += pricing.rephrasing.fast;
        }
        if (serviceTranslation.checked) {
            priceNormal += pricing.translation.normal;
            priceFast += pricing.translation.fast;
        }

        labelDeliveryNormal.textContent = `مدة عادية (${priceNormal}$ للصفحة)`;
        labelDeliveryFast.textContent = `مدة سريعة (${priceFast}$ للصفحة)`;

        // After updating labels, recalculate the total price
        calculatePrice();
    }

    function calculatePrice() {
        if (currentPageCount <= 0) {
            manualTotalPriceDisplay.textContent = '$0.00';
            submitButton.disabled = true;
            return;
        }

        let combinedPricePerPage = 0;
        const selectedDeliveryType = document.querySelector('input[name="deliveryTime"]:checked').value;

        if (serviceRephrasing.checked) {
            combinedPricePerPage += pricing.rephrasing[selectedDeliveryType];
        }
        if (serviceTranslation.checked) {
            combinedPricePerPage += pricing.translation[selectedDeliveryType];
        }

        const totalPrice = combinedPricePerPage * currentPageCount;
        manualTotalPriceDisplay.textContent = `$${totalPrice.toFixed(2)}`;
        submitButton.disabled = (totalPrice <= 0);
    }

    function handleServiceTypeChange() {
        const anyServiceSelected = serviceRephrasing.checked || serviceTranslation.checked;

        if (anyServiceSelected) {
            deliveryOptionsShared.classList.remove('hidden');
            globalUploadBtn.classList.remove('hidden');
        } else {
            deliveryOptionsShared.classList.add('hidden');
            globalUploadBtn.classList.add('hidden');
        }
        
        updateSharedDeliveryOptions();
    }

    function resetForm() {
        currentFile = null;
        currentPageCount = 0;
        fileInput.value = '';
        
        serviceTypeCheckboxes.forEach(cb => cb.checked = false);
        analysisResults.classList.add('hidden');
        deliveryOptionsShared.classList.add('hidden');
        globalUploadBtn.classList.add('hidden');

        analysisMessage.textContent = '';
        fileNameDisplay.textContent = '';
        wordCountDisplay.textContent = '';
        pageCountDisplay.textContent = '';
        customerEmailInput.value = '';
        manualTotalPriceDisplay.textContent = '$0.00';
        submitButton.disabled = true;
    }

    async function submitOrder() {
        if (!confirm("هل أنت متأكد من إرسال الملف؟ يرجى التأكد من عدم وجود أخطاء في اختيارك أو في اتباع التعليمات")) {
            return; 
        }
        if (!currentFile) {
            alert('يرجى اختيار ملف أولاً.');
            return;
        }

        const selectedServices = [];
        if (serviceRephrasing.checked) selectedServices.push('إعادة صياغة');
        if (serviceTranslation.checked) selectedServices.push('ترجمة');

        if (selectedServices.length === 0) {
            alert('يرجى اختيار خدمة واحدة على الأقل.');
            return;
        }

        const selectedDelivery = document.querySelector('input[name="deliveryTime"]:checked');
        const deliveryTimeLabel = selectedDelivery.parentElement.querySelector('label').textContent.trim();

        submitButton.disabled = true;
        submitButton.textContent = 'جاري الإرسال...';

        const userEmail = customerEmailInput.value;
        if (!userEmail || !/\S+@\S+\.\S+/.test(userEmail)) {
            alert('يرجى إدخال بريد إلكتروني صحيح للمتابعة.');
            submitButton.disabled = false;
            submitButton.textContent = 'إرسال';
            return;
        }

        const formData = new FormData();
        formData.append('document', currentFile);
        formData.append('userEmail', userEmail);
        formData.append('services', JSON.stringify(selectedServices));
        formData.append('deliveryTime', deliveryTimeLabel);
        formData.append('totalPrice', manualTotalPriceDisplay.textContent);

        try {
            const response = await fetch('/submit-order', { method: 'POST', body: formData });
            const result = await response.json();
            if (response.ok && result.success) {
                window.location.href = 'success.html';
            } else {
                throw new Error(result.message || 'فشل إرسال الطلب.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert(`حدث خطأ: ${error.message}`);
            submitButton.disabled = false;
            submitButton.textContent = 'إرسال';
        }
    }

    // --- Event Handlers ---
    loginButton?.addEventListener('click', showAppView);
    logoutButton?.addEventListener('click', showLoginView);
    submitButton?.addEventListener('click', submitOrder);
    globalUploadBtn?.addEventListener('click', () => fileInput.click());
    serviceTypeCheckboxes.forEach(option => option.addEventListener('change', handleServiceTypeChange));
    sharedDeliveryRadios.forEach(option => option.addEventListener('change', calculatePrice));
    fileInput?.addEventListener('change', () => {
        if (fileInput.files.length > 0) { processFile(fileInput.files[0]); }
    });

    // Initial setup on page load
    resetForm();
});

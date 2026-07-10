(function () {
    const cards = document.querySelectorAll('.rg-payment-card');
    const loadedCurrencies = new Map();

    function loadPayPalSdk(clientId, currency, locale) {
        const key = `${clientId}:${currency}:${locale}`;
        if (loadedCurrencies.has(key)) return loadedCurrencies.get(key);

        const params = new URLSearchParams({
            'client-id': clientId,
            currency,
            locale,
            intent: 'capture',
            components: 'buttons'
        });

        const promise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
            script.addEventListener('load', resolve, { once: true });
            script.addEventListener('error', reject, { once: true });
            document.head.appendChild(script);
        });

        loadedCurrencies.set(key, promise);
        return promise;
    }

    function setStatus(element, message, type) {
        element.textContent = message;
        element.classList.remove('success', 'error');
        if (type) element.classList.add(type);
    }

    function normaliseAmount(value) {
        const amount = Number.parseFloat(String(value).replace(/,/g, ''));
        if (!Number.isFinite(amount) || amount <= 0) return null;
        return amount.toFixed(2);
    }

    function initPaymentCard(card) {
        const clientId = card.dataset.paypalClientId;
        const currency = card.dataset.currency || 'AUD';
        const locale = card.dataset.paypalLocale || 'en_AU';
        const itemSelect = card.querySelector('#rgPaymentItem');
        const amountInput = card.querySelector('#rgPaymentAmount');
        const referenceInput = card.querySelector('#rgPaymentReference');
        const prepareButton = card.querySelector('#rgPaymentPrepare');
        const buttonsContainer = card.querySelector('#rgPaypalButtons');
        const status = card.querySelector('#rgPaymentStatus');

        if (!clientId || !itemSelect || !amountInput || !prepareButton || !buttonsContainer || !status) return;

        prepareButton.addEventListener('click', async () => {
            const amount = normaliseAmount(amountInput.value);
            if (!amount) {
                setStatus(status, 'Enter a valid amount greater than 0.', 'error');
                amountInput.focus();
                return;
            }

            buttonsContainer.innerHTML = '';
            setStatus(status, 'Loading PayPal checkout...', null);

            try {
                await loadPayPalSdk(clientId, currency, locale);

                window.paypal.Buttons({
                    style: {
                        layout: 'vertical',
                        shape: 'rect',
                        label: 'paypal'
                    },
                    createOrder: (data, actions) => {
                        const reference = referenceInput && referenceInput.value.trim()
                            ? ` (${referenceInput.value.trim()})`
                            : '';

                        return actions.order.create({
                            intent: 'CAPTURE',
                            purchase_units: [
                                {
                                    description: `${itemSelect.value}${reference}`,
                                    amount: {
                                        currency_code: currency,
                                        value: amount
                                    }
                                }
                            ],
                            application_context: {
                                shipping_preference: 'NO_SHIPPING'
                            }
                        });
                    },
                    onApprove: async (data, actions) => {
                        setStatus(status, 'Confirming payment...', null);
                        const details = await actions.order.capture();
                        const payerName = details?.payer?.name?.given_name || 'there';
                        setStatus(status, `Payment received. Thank you, ${payerName}.`, 'success');
                    },
                    onCancel: () => {
                        setStatus(status, 'Payment cancelled before completion.', 'error');
                    },
                    onError: () => {
                        setStatus(status, 'PayPal checkout failed. Please try again or contact Retragreen.', 'error');
                    }
                }).render(buttonsContainer);

                setStatus(status, `Ready to pay ${currency} ${amount} securely with PayPal.`, null);
            } catch (error) {
                setStatus(status, 'Unable to load PayPal checkout. Please refresh and try again.', 'error');
            }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        cards.forEach(initPaymentCard);
    });
})();

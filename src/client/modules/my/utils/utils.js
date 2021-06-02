const fireLoading = (loading) => {
    return new CustomEvent('loading', {
        bubbles: true,
        composed: true,
        detail: { loading: loading }
    });
};
const showToast = (title, message) => {
    let toastNotification = {
        title: title,
        message: message
    };
    return new CustomEvent('toastfired', {
        bubbles: true,
        composed: true,
        detail: toastNotification
    });
};

export { fireLoading, showToast };

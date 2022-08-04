export async function showInstallButton() {
    return new Promise(resolve => {
        window.addEventListener('beforeinstallprompt', e => {
            e.preventDefault();
            resolve(e);


        })
    });
}

export async function showInstallPrompt(deferredPrompt: Event) {
    // Show the prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const choiceResult = await deferredPrompt.userChoice
    if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the A2HS prompt');
    } else {
        console.log('User dismissed the A2HS prompt');
    }
}

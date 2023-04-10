const { exec } = require('child_process');
exec('npm ls -g --depth=0', (err, stdout, stderr) => {
    if (err) {
        console.error(err);
        return;
    }
    const modules = stdout.split('\n').slice(1, -1);
    modules.forEach(module => {
        exec(`npm uninstall -g ${module}`, (err, stdout, stderr) => {
            if (err) {
                console.error(err);
                return;
            }
            console.log(`Uninstalled ${module}`);
        });
    });
});
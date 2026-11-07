# zimanyar

Offline grammar checker and teacher for Kurdish (Sorani and Kurmanji), for the command line and for continuous integration.

```sh
npm install -g zimanyar

zimanyar check --lang kmr --format json README.ku.md   # exit code 1 when errors are found
zimanyar check --format sarif docs/*.md > zimanyar.sarif
echo "Min tu dîtim." | zimanyar check
zimanyar conjugate dîtin
zimanyar decline kitêb
zimanyar explain kmr.ergative.agreement
zimanyar lesson ergativity
```

Everything runs on your computer: no command makes a network request. See `man zimanyar` or `zimanyar --help`, and <https://0xdolan.github.io/Zimanyar/>.

Licensed under GPL-3.0-or-later. The word data comes from zimankit and is licensed under CC BY-SA 4.0. `dist/THIRD-PARTY-NOTICES.txt` lists the bundled packages and their licences.

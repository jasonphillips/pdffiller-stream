const escapeString = function escapeString(value) {
    if ( value === null || value === undefined ) {
        return "";
    }
    return Buffer.from(
        value
            .toString()
            .replace(/\\/g, "\\\\")
            .replace(/\(/g, "\\(")
            .replace(/\)/g, "\\)")
    ).toString("utf8");
}

exports.createFdf = function (data) {
    // only this sequence in FDF header requires char codes
    const header = Buffer.from(
        `%FDF-1.2\n${
            String.fromCharCode(226) +
            String.fromCharCode(227) +
            String.fromCharCode(207) +
            String.fromCharCode(211)
        }\n1 0 obj \n<<\n/FDF \n<<\n/Fields [\n`
    );

    let body = Buffer.from([]);

    for (const name of Object.keys(data)) {
        try {
            body = Buffer.concat([
                body,
                Buffer.from(`<<\n/T (${escapeString(name)})\n/V (${escapeString(data[name])})\n>>\n`)
            ]);
        } catch (err) {
            throw Error(`Cannot escape string: '${name}: ${data[name]}'.`);
        }
    }

    const footer = Buffer.from(
        `]\n>>\n>>\nendobj \ntrailer\n\n<<\n/Root 1 0 R\n>>\n%%EOF\n`
    );

    return Buffer.concat([header, body, footer]);
}

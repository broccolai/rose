import { createHandler, type DocumentComponentProps, StartServer } from '@solidjs/start/server';

function Document(props: DocumentComponentProps) {
    return (
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>Rose Vault Export</title>
                {props.assets}
            </head>
            <body>
                <div id="app">{props.children}</div>
                {props.scripts}
            </body>
        </html>
    );
}

export default createHandler(() => <StartServer document={Document} />);

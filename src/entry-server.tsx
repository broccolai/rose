import { createHandler, type DocumentComponentProps, StartServer } from '@solidjs/start/server';

function Document(props: DocumentComponentProps) {
    return (
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>ARMOR</title>
                <link rel="icon" type="image/png" href="/canvas.png" />
                <link rel="apple-touch-icon" href="/canvas.png" />
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

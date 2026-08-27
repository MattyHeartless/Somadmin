# SOMA Admin

Panel de operación de eventos y control de acceso para SOMA Music Hub.

## Aplicación web

Requiere Node 20+.

    npm install
    npm run dev

Copiar .env.example a .env.local para cambiar la URL de la API durante el
desarrollo.

La primera superficie disponible es el dashboard SOMA y su scanner demostrable.

## API

La API usa .NET 10 y SQL Server. En este entorno se instaló un SDK local en
.tools/dotnet, por lo que puede compilarse así:

    ./.tools/dotnet/dotnet build backend/Soma.Admin.Api/Soma.Admin.Api.csproj

Para iniciar SQL Server:

    docker compose up -d sqlserver

El contenedor usa el puerto local 1434 para no interferir con instalaciones
locales que ya ocupen el puerto 1433.

En Apple Silicon, Docker usa Azure SQL Edge como implementación compatible para
desarrollo local. El proveedor EF Core y el contrato de producción continúan
siendo SQL Server.

Antes de ejecutar la API se deben crear las migraciones EF Core y configurar
Jwt:SigningKey mediante user-secrets o variables de entorno. Nunca usar el
valor de ejemplo de appsettings.json en producción.

Para crear el primer administrador, definir las variables de entorno
BootstrapAdmin__Email y BootstrapAdmin__Password antes de iniciar la API. El
usuario se crea una sola vez y recibe el rol Admin.

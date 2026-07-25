## Base de datos obligatoria
- Este proyecto utiliza exclusivamente MySQL.
- La base real se llama `yucafish`.
- Está prohibido agregar SQLite, bases locales o fallbacks de base de datos.
- Nunca cambiar el provider del ORM.
- Nunca ejecutar resets, seeds, db push o migraciones destructivas contra producción sin autorización explícita.
- Antes de modificar modelos o migraciones, revisar el esquema y los datos existentes.
- Toda funcionalidad debe ser compatible con MySQL en desarrollo y producción.

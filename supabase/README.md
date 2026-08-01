# Supabase

## Configuração

1. Crie um projeto no Supabase.
2. Execute `migrations/20260731000000_initial_schema.sql` no SQL Editor.
3. Se os dados fictícios antigos foram inseridos, rode `clear-demo-data.sql` para removê-los.
4. Crie o usuário administrador em **Authentication > Users**.
5. Promova esse usuário para `admin` usando o SQL abaixo.
6. Copie `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` para `.env.local`.
7. Reinicie o servidor local depois de alterar o `.env.local`.

## Login automático dos representantes

Execute a migration `migrations/20260801000000_representative_usernames.sql` e faça o deploy da função:

```sh
supabase functions deploy create-representative-account
```

A função usa `SUPABASE_SERVICE_ROLE_KEY` somente no ambiente seguro da Edge Function. Nunca coloque essa chave em `.env.local` ou no frontend.

Na aba **Usuários**, o Admin escolhe uma representação e informa o usuário e a senha. O sistema cria automaticamente:

- usuário: o nome informado sem espaços e acentos;
- senha: a senha informada pelo Admin;
- vínculo do usuário com a representação.

Exemplo: representação `Roma`, usuário `reinaldo`, senha `romarepresent`.

## Primeiro administrador

Depois de criar o usuário no Auth, execute:

```sql
update public.profiles
set role = 'admin'
where id = 'UUID_DO_USUARIO';
```

O usuário precisa existir em **Authentication > Users** antes desse comando. O trigger da migration cria automaticamente a linha correspondente em `public.profiles`.

## Vincular representante

```sql
insert into public.representation_members (user_id, representation_id)
values ('UUID_DO_USUARIO', 'UUID_DA_REPRESENTACAO');
```

As políticas RLS permitem que o Admin veja e gerencie tudo. O representante consegue ler somente sua representação, colaboradores, resultados, metas e saídas vinculadas a ela. A chave `service_role` nunca deve ser colocada no frontend.

## Por que o painel pode aparecer vazio

O frontend usa a chave pública e as políticas RLS. Portanto, a sessão precisa estar autenticada e o perfil precisa ter `role = 'admin'` para listar todas as representações. Se o usuário ainda estiver como `representante` ou sem vínculo em `representation_members`, o Supabase retorna uma lista vazia por segurança.

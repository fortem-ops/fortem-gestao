# Corrigir acesso ao cadastro do Portal do Aluno

## Diagnóstico

A rota de cadastro **existe**, mas está registrada em português como `/portal/cadastro` (não `/portal/signup`). O link "Criar conta" no rodapé da tela de login (`/portal/login`) já aponta corretamente para ela — provavelmente passou despercebido por estar pequeno e sem destaque.

## Mudanças propostas

### 1. Adicionar alias `/portal/signup` em `src/App.tsx`
Registrar a mesma página `PortalSignUp` também em `/portal/signup`, para que ambas as URLs funcionem (compatibilidade com quem digitar em inglês). O mesmo será feito para `/portal/forgot-password` → `PortalRecoverPassword` e `/portal/reset-password` → `PortalResetPassword`.

### 2. Destacar o "Criar conta" em `src/pages/portal/PortalLogin.tsx`
Transformar o link discreto em um **bloco visível abaixo do botão Entrar**, com texto "Ainda não tem conta? **Criar conta**" e um botão `variant="outline"` ocupando largura total. Manter "Esqueci minha senha" como link sutil acima.

## Resultado esperado

- `/portal/signup` e `/portal/cadastro` ambos abrem a tela de cadastro.
- A opção "Criar conta" fica imediatamente visível abaixo do formulário de login, sem precisar procurar.

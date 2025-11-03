-- Asignar rol de administrador al usuario de pruebas
INSERT INTO public.user_roles (user_id, role)
VALUES ('dc1cb1ca-e3ac-43fe-8dd8-0288620c13aa', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Comentario: Usuario admin creado para trayenkooliva@gmail.com
USE estacao_db;

INSERT INTO categories (name, slug) VALUES
('Buquês', 'buque'),
('Arranjos', 'arranjo'),
('Plantas', 'planta'),
('Presentes', 'presente')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO products (category_id, name, description, price, image_url, stock_quantity, is_active)
SELECT c.id, p.name, p.description, p.price, p.image_url, p.stock_quantity, TRUE
FROM categories c
JOIN (
  SELECT 'buque' AS category_slug, 'Buquê de rosas cor-de-rosa' AS name, 'Rosas em tons rosados, folhagem delicada e embalagem de papel natural.' AS description, 129.90 AS price, 'https://images.unsplash.com/photo-1494972308805-463bc619d34e?auto=format&fit=crop&w=900&q=85' AS image_url, 8 AS stock_quantity
  UNION ALL SELECT 'buque', 'Girassóis de sábado', 'Girassóis alegres com acabamento simples em papel kraft.', 89.90, 'https://images.unsplash.com/photo-1597848212624-e6b9b4e3b6e5?auto=format&fit=crop&w=900&q=85', 6
  UNION ALL SELECT 'buque', 'Buquê campo misto', 'Uma mistura leve de flores da estação em cores suaves.', 109.90, 'https://images.unsplash.com/photo-1487530811176-3780de880c2d?auto=format&fit=crop&w=900&q=85', 5
  UNION ALL SELECT 'buque', 'Buquê de tulipas', 'Tulipas em embalagem minimalista. A cor varia conforme a disponibilidade.', 159.90, 'https://images.unsplash.com/photo-1520763185298-1b434c919102?auto=format&fit=crop&w=900&q=85', 4
  UNION ALL SELECT 'arranjo', 'Arranjo em vaso de vidro', 'Flores variadas montadas em vaso de vidro transparente.', 139.90, 'https://images.unsplash.com/photo-1508610048659-a06b669e3321?auto=format&fit=crop&w=900&q=85', 5
  UNION ALL SELECT 'arranjo', 'Cesta de flores delicadas', 'Composição floral em cesta, pronta para presentear.', 169.90, 'https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=900&q=85', 3
  UNION ALL SELECT 'arranjo', 'Mini arranjo de mesa', 'Arranjo compacto para deixar a mesa mais bonita.', 69.90, 'https://images.unsplash.com/photo-1508610048659-a06b669e3321?auto=format&fit=crop&w=900&q=85', 9
  UNION ALL SELECT 'planta', 'Orquídea em vaso', 'Orquídea ornamental em vaso decorativo. A floração pode variar.', 149.90, 'https://images.unsplash.com/photo-1566920156325-1e9f9f3b4c89?auto=format&fit=crop&w=900&q=85', 4
  UNION ALL SELECT 'planta', 'Jiboia para interiores', 'Planta de fácil cuidado, indicada para ambientes iluminados sem sol direto.', 49.90, 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&w=900&q=85', 10
  UNION ALL SELECT 'planta', 'Suculenta no vaso', 'Suculenta em vaso pequeno. O formato da planta pode variar.', 34.90, 'https://images.unsplash.com/photo-1509423350716-97f9360b4e09?auto=format&fit=crop&w=900&q=85', 12
  UNION ALL SELECT 'presente', 'Caixa de chocolates', 'Caixa de chocolates para acompanhar o seu arranjo.', 39.90, 'https://images.unsplash.com/photo-1548907040-4d42f8f0a3a3?auto=format&fit=crop&w=900&q=85', 15
  UNION ALL SELECT 'presente', 'Cartão com mensagem', 'Cartão para escrever uma mensagem especial e enviar junto com as flores.', 9.90, 'https://images.unsplash.com/photo-1512412046876-f386342eddb3?auto=format&fit=crop&w=900&q=85', 30
) AS p ON p.category_slug = c.slug
WHERE NOT EXISTS (SELECT 1 FROM products existing WHERE existing.name = p.name);

-- Seed stock (matches legacy db.js)
INSERT INTO stock (item_size, quantity) VALUES
  ('1.5 feet (Wood)', 0), ('2.0 feet (Wood)', 0), ('2.5 feet (Wood)', 0), ('3.0 feet (Wood)', 0), ('3.5 feet (Wood)', 0), ('4.0 feet (Wood)', 0),
  ('1.5 feet (PVC)', 0), ('2.0 feet (PVC)', 0), ('2.5 feet (PVC)', 0), ('3.0 feet (PVC)', 0), ('3.5 feet (PVC)', 0), ('4.0 feet (PVC)', 0),
  ('Ladder 3.0ft', 0), ('Ladder 4.0ft', 0),
  ('Coir Pot Size 1', 0), ('Coir Pot Size 2', 0), ('Coir Pot Size 3', 0),
  ('Orchid Support 12x12', 0), ('Orchid Support 12x14', 0)
ON CONFLICT (item_size) DO NOTHING;

INSERT INTO prices (item_name, price) VALUES
  ('1.5 feet (Wood)', 150), ('2.0 feet (Wood)', 200), ('2.5 feet (Wood)', 250), ('3.0 feet (Wood)', 300), ('3.5 feet (Wood)', 350), ('4.0 feet (Wood)', 400),
  ('1.5 feet (PVC)', 100), ('2.0 feet (PVC)', 150), ('2.5 feet (PVC)', 200), ('3.0 feet (PVC)', 250), ('3.5 feet (PVC)', 300), ('4.0 feet (PVC)', 350),
  ('Ladder 3.0ft', 500), ('Ladder 4.0ft', 600),
  ('Coir Pot Size 1', 50), ('Coir Pot Size 2', 75), ('Coir Pot Size 3', 100),
  ('Orchid Support 12x12', 120), ('Orchid Support 12x14', 140)
ON CONFLICT (item_name) DO NOTHING;

INSERT INTO expense_categories (name) VALUES
  ('Wood'), ('PVC'), ('Coir'), ('Wrapping Sheets'), ('Glue Tape'), ('Stickers'),
  ('Wire Mesh'), ('Screws'), ('Transport'), ('Sugar/Tea'), ('Snacks'),
  ('Home Expenses'), ('Salaries'), ('Tools')
ON CONFLICT (name) DO NOTHING;

INSERT INTO employees (name) VALUES
  ('නිලුකා'), ('සුරන්ගී'), ('රම්යලතා'), ('ස්වර්නා'), ('තුශාරිකා')
ON CONFLICT (name) DO NOTHING;

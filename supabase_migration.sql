-- ============================================================
  -- Flashcards App — Supabase Migration Script
  -- Run this in: Supabase Dashboard → SQL Editor → New query
  -- ============================================================

  -- 1. SCHEMA
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

  CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS team_members (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member',
    status TEXT DEFAULT 'pending',
    joined_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS flashcards (
    id SERIAL PRIMARY KEY,
    simplified TEXT NOT NULL,
    traditional TEXT NOT NULL,
    pinyin TEXT NOT NULL DEFAULT '',
    english TEXT NOT NULL DEFAULT '',
    unit_number TEXT NOT NULL DEFAULT '',
    unit_name TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_flashcards_unit ON flashcards(unit_number);

  CREATE TABLE IF NOT EXISTS mastered_cards (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    simplified TEXT NOT NULL,
    unit_number TEXT,
    mastered_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS completed_lessons (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    unit_numbers TEXT,
    time_ms INTEGER,
    completed_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- 2. USERS
INSERT INTO users (id, username, display_name, avatar_url, email, created_at) VALUES (1, 'bestkid', '小潔', '🐔', 'test@gmail.com', '2026-05-02 15:47:25.650273') ON CONFLICT (id) DO NOTHING;
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- 3. TEAMS
INSERT INTO teams (id, name, description, created_at) VALUES (1, 'BestTeamEver', NULL, '2026-05-02 15:48:36.841026') ON CONFLICT (id) DO NOTHING;
SELECT setval('teams_id_seq', (SELECT MAX(id) FROM teams));

-- 4. TEAM MEMBERS
INSERT INTO team_members (id, team_id, user_id, role, status, joined_at) VALUES (1, 1, 1, 'owner', 'approved', '2026-05-02 15:48:36.841026') ON CONFLICT (id) DO NOTHING;
SELECT setval('team_members_id_seq', (SELECT MAX(id) FROM team_members));

-- 5. FLASHCARDS
INSERT INTO flashcards (id, simplified, traditional, pinyin, english, unit_number, unit_name) VALUES
  (1, '米饭', '米飯', 'mǐ fàn', 'rice', '1', 'Basic Food'),
  (2, '面条', '麵條', 'miàn tiáo', 'noodles', '1', 'Basic Food'),
  (3, '面包', '麵包', 'miàn bāo', 'bread', '1', 'Basic Food'),
  (4, '包子', '包子', 'bāo zi', 'steamed bun', '1', 'Basic Food'),
  (5, '饺子', '餃子', 'jiǎo zi', 'dumpling', '1', 'Basic Food'),
  (6, '猪肉', '豬肉', 'zhū ròu', 'pork', '1', 'Basic Food'),
  (7, '牛肉', '牛肉', 'niú ròu', 'beef', '1', 'Basic Food'),
  (8, '鸡肉', '雞肉', 'jī ròu', 'chicken', '1', 'Basic Food'),
  (9, '鱼肉', '魚肉', 'yú ròu', 'fish', '1', 'Basic Food'),
  (10, '鸡蛋', '雞蛋', 'jī dàn', 'egg', '1', 'Basic Food'),
  (11, '蔬菜', '蔬菜', 'shū cài', 'vegetables', '1', 'Basic Food'),
  (12, '白菜', '白菜', 'bái cài', 'cabbage', '1', 'Basic Food'),
  (13, '红萝卜', '紅蘿蔔', 'hóng luó bo', 'Carrot', '1', 'Basic Food'),
  (14, '土豆', '土豆', 'tǔ dòu', 'potato', '1', 'Basic Food'),
  (15, '番茄', '蕃茄', 'fān qié', 'tomato', '1', 'Basic Food'),
  (16, '苹果', '蘋果', 'píng guǒ', 'apple', '1', 'Basic Food'),
  (17, '香蕉', '香蕉', 'xiāng jiāo', 'banana', '1', 'Basic Food'),
  (18, '桔子', '橘子', 'jú zi', 'orange', '1', 'Basic Food'),
  (19, '西瓜', '西瓜', 'xī guā', 'watermelon', '1', 'Basic Food'),
  (20, '水', '水', 'shuǐ', 'water', '1', 'Basic Food'),
  (21, '茶', '茶', 'chá', 'tea', '1', 'Basic Food'),
  (22, '绿茶', '綠茶', 'lǜ chá', 'green tea', '1', 'Basic Food'),
  (23, '咖啡', '咖啡', 'kā fēi', 'coffee', '1', 'Basic Food'),
  (24, '牛奶', '牛奶', 'niú nǎi', 'milk', '1', 'Basic Food'),
  (25, '火锅', '火鍋', 'huǒ guō', 'hot pot', '1', 'Basic Food'),
  (26, '炒饭', '炒飯', 'chǎo fàn', 'Fried Rice', '1', 'Basic Food'),
  (27, '葡萄', '葡萄', 'pú tao', 'Grape', '1', 'Basic Food'),
  (28, '春卷', '春捲', 'chūn juǎn', 'Spring Roll', '1', 'Basic Food'),
  (29, '蛋饼', '蛋餅', 'dàn bǐng', '', '1', 'Basic Food'),
  (30, '起司蛋吐司', '起司蛋吐司', 'qǐ sī dàn tǔ sī', 'Cheese & Egg Toast', '2', 'Breakfast Shop Menu'),
  (31, '玉米蛋吐司', '玉米蛋吐司', 'yù mǐ dàn tǔ sī', 'Corn & Egg Toast', '2', 'Breakfast Shop Menu'),
  (32, '火腿蛋吐司', '火腿蛋吐司', 'huǒ tuǐ dàn tǔ sī', 'Ham & Egg Toast', '2', 'Breakfast Shop Menu'),
  (33, '肉松蛋吐司', '肉鬆蛋吐司', 'ròu sōng dàn tǔ sī', 'Pork Floss & Egg Toast', '2', 'Breakfast Shop Menu'),
  (34, '培根蛋吐司', '培根蛋吐司', 'péi gēn dàn tǔ sī', 'Bacon & Egg Toast', '2', 'Breakfast Shop Menu'),
  (35, '鲔魚蛋吐司', '鮪魚蛋吐司', 'wěi yú dàn tǔ sī', 'Tuna & Egg Toast', '2', 'Breakfast Shop Menu'),
  (36, '薯饼蛋吐司', '薯餅蛋吐司', 'shǔ bǐng dàn tǔ sī', 'Hash Brown & Egg Toast', '2', 'Breakfast Shop Menu'),
  (37, '猪排蛋吐司', '豬排蛋吐司', 'zhū pái dàn tǔ sī', 'Pork Chop & Egg Toast', '2', 'Breakfast Shop Menu'),
  (38, '熏鸡蛋吐司', '燻雞蛋吐司', 'xūn jī dàn tǔ sī', 'Smoked Chicken & Egg Toast', '2', 'Breakfast Shop Menu'),
  (39, '香酥鸡蛋吐司', '香酥雞蛋吐司', 'xiāng sū jī dàn tǔ sī', 'Crispy Chicken & Egg Toast', '2', 'Breakfast Shop Menu'),
  (40, '菲力鸡排蛋吐司', '菲力雞排蛋吐司', 'fēi lì jī pái dàn tǔ sī', 'Filet Chicken & Egg Toast', '2', 'Breakfast Shop Menu'),
  (41, '黄金虾排蛋吐司', '黃金蝦排蛋吐司', 'huáng jīn xiā pái dàn tǔ sī', 'Golden Shrimp Patty & Egg Toast', '2', 'Breakfast Shop Menu'),
  (42, '卡拉鸡腿蛋吐司', '卡拉雞腿蛋吐司', 'kǎ lā jī tuǐ dàn tǔ sī', 'Karaage Chicken Leg & Egg Toast', '2', 'Breakfast Shop Menu'),
  (43, '原味蛋饼', '原味蛋餅', 'yuán wèi dàn bǐng', 'Original Egg Crepe', '2', 'Breakfast Shop Menu'),
  (44, '起司蛋饼', '起司蛋餅', 'qǐ sī dàn bǐng', 'Cheese Egg Crepe', '2', 'Breakfast Shop Menu'),
  (45, '玉米蛋饼', '玉米蛋餅', 'yù mǐ dàn bǐng', 'Corn Egg Crepe', '2', 'Breakfast Shop Menu'),
  (46, '火腿蛋饼', '火腿蛋餅', 'huǒ tuǐ dàn bǐng', 'Ham Egg Crepe', '2', 'Breakfast Shop Menu'),
  (47, '热狗蛋饼', '熱狗蛋餅', 'rè gǒu dàn bǐng', 'Hot Dog Egg Crepe', '2', 'Breakfast Shop Menu'),
  (48, '培根蛋饼', '培根蛋餅', 'péi gēn dàn bǐng', 'Bacon Egg Crepe', '2', 'Breakfast Shop Menu'),
  (49, '鲔魚蛋饼', '鮪魚蛋餅', 'wěi yú dàn bǐng', 'Tuna Egg Crepe', '2', 'Breakfast Shop Menu'),
  (50, '薯饼蛋饼', '薯餅蛋餅', 'shǔ bǐng dàn bǐng', 'Hash Brown Egg Crepe', '2', 'Breakfast Shop Menu'),
  (51, '熏鸡蛋饼', '燻雞蛋餅', 'xūn jī dàn bǐng', 'Smoked Chicken Egg Crepe', '2', 'Breakfast Shop Menu'),
  (52, '猪排蛋饼', '豬排蛋餅', 'zhū pái dàn bǐng', 'Pork Chop Egg Crepe', '2', 'Breakfast Shop Menu'),
  (53, '原味抓饼', '原味抓餅', 'yuán wèi zhuā bǐng', 'Plain Scallion Pancake', '2', 'Breakfast Shop Menu'),
  (54, '起司抓饼', '起司抓餅', 'qǐ sī zhuā bǐng', 'Cheese Scallion Pancake', '2', 'Breakfast Shop Menu'),
  (55, '玉米抓饼', '玉米抓餅', 'yù mǐ zhuā bǐng', 'Corn Scallion Pancake', '2', 'Breakfast Shop Menu'),
  (56, '火腿抓饼', '火腿抓餅', 'huǒ tuǐ zhuā bǐng', 'Ham Scallion Pancake', '2', 'Breakfast Shop Menu'),
  (57, '培根抓饼', '培根抓餅', 'péi gēn zhuā bǐng', 'Bacon Scallion Pancake', '2', 'Breakfast Shop Menu'),
  (58, '鲔魚抓饼', '鮪魚抓餅', 'wěi yú zhuā bǐng', 'Tuna Scallion Pancake', '2', 'Breakfast Shop Menu'),
  (59, '熏鸡抓饼', '燻雞抓餅', 'xūn jī zhuā bǐng', 'Smoked Chicken Scallion Pancake', '2', 'Breakfast Shop Menu'),
  (60, '猪排抓饼', '豬排抓餅', 'zhū pái zhuā bǐng', 'Pork Chop Scallion Pancake', '2', 'Breakfast Shop Menu'),
  (61, '荷包蛋', '荷包蛋', 'hé bāo dàn', 'Fried Egg', '3', 'Breakfast Shop Menu'),
  (62, '葱餅', '蔥餅', 'cōng bǐng', 'Scallion Pie', '3', 'Breakfast Shop Menu'),
  (63, '热狗', '熱狗', 'rè gǒu', 'Hot Dog', '3', 'Breakfast Shop Menu'),
  (64, '薯条', '薯條', 'shǔ tiáo', 'French Fries', '3', 'Breakfast Shop Menu'),
  (65, '薯饼', '薯餅', 'shǔ bǐng', 'Hash Brown', '3', 'Breakfast Shop Menu'),
  (66, '鸡塊', '雞塊', 'jī kuài', 'Chicken Nuggets', '3', 'Breakfast Shop Menu'),
  (67, '萝卜糕', '蘿蔔糕', 'luó bo gāo', 'Turnip Cake', '3', 'Breakfast Shop Menu'),
  (68, '鲔魚起司总汇', '鮪魚起司總匯', 'wěi yú qǐ sī zǒng huì', 'Tuna & Cheese Club', '3', 'Breakfast Shop Menu'),
  (69, '起司猪排总汇', '起司豬排總匯', 'qǐ sī zhū pái zǒng huì', 'Cheese & Pork Chop Club', '3', 'Breakfast Shop Menu'),
  (70, '经典总汇', '經典總匯', 'jīng diǎn zǒng huì', 'Classic Club', '3', 'Breakfast Shop Menu'),
  (71, '豪迈猪排总汇', '豪邁豬排總匯', 'háo mài zhū pái zǒng huì', 'Hearty Pork Chop Club', '3', 'Breakfast Shop Menu'),
  (72, '卡拉鸡腿总汇', '卡拉雞腿總匯', 'kǎ lā jī tuǐ zǒng huì', 'Karaage Chicken Leg Club', '3', 'Breakfast Shop Menu'),
  (73, '单点', '單點', 'dān diǎn', '"""A la carte"', '3', 'Breakfast Shop Menu'),
  (74, '蘑菇铁板面', '蘑菇鐵板麵', 'mó gū tiě bǎn miàn', 'Mushroom Iron-Plate Noodles', '3', 'Breakfast Shop Menu'),
  (75, '黑胡椒铁板', '黑胡椒鐵板麵', 'hēi hú jiāo tiě bǎn miàn', 'Black Pepper Iron-Plate Noodles', '3', 'Breakfast Shop Menu'),
  (76, '内用', '內用', 'nèi yòng', 'For Here', '3', 'Breakfast Shop Menu'),
  (77, '外带', '外帶', 'wài dài', 'To Go', '3', 'Breakfast Shop Menu'),
  (78, '加起司', '加起司', 'jiā qǐ sī', 'Add Cheese', '3', 'Breakfast Shop Menu'),
  (79, '加蛋', '加蛋', 'jiā dàn', 'Add Egg', '3', 'Breakfast Shop Menu'),
  (80, '不要辣', '不要辣', 'bú yào là', 'No Spicy', '3', 'Breakfast Shop Menu'),
  (81, '不要香菜', '不要香菜', 'bú yào xiāng cài', 'No Cilantro', '3', 'Breakfast Shop Menu'),
  (82, '少盐', '少鹽', 'shǎo yán', 'Less Salt', '3', 'Breakfast Shop Menu'),
  (83, '冰', '冰', 'bīng', 'Iced', '4', 'Drink'),
  (84, '热', '熱', 'rè', 'Hot', '4', 'Drink'),
  (85, '去冰', '去冰', 'qù bīng', 'No Ice', '4', 'Drink'),
  (86, '少冰', '少冰', 'shǎo bīng', 'Less Ice', '4', 'Drink'),
  (87, '微糖', '微糖', 'wéi táng', 'Light Sugar', '4', 'Drink'),
  (88, '半糖', '半糖', 'bàn táng', 'Half Sugar', '4', 'Drink'),
  (89, '无糖', '無糖', 'wú táng', 'No Sugar', '4', 'Drink'),
  (90, '红茶', '紅茶', 'hóng chá', 'Black Tea', '4', 'Drink'),
  (91, '奶茶', '奶茶', 'nǎi chá', 'Milk Tea', '4', 'Drink'),
  (92, '豆浆', '豆漿', 'dòu jiāng', 'Soy Milk', '4', 'Drink'),
  (93, '鲜奶茶', '鮮奶茶', 'xiān nǎi chá', 'Fresh Milk Tea', '4', 'Drink'),
  (94, '黑咖啡', '黑咖啡', 'hēi kā fēi', 'Black Coffee', '4', 'Drink'),
  (95, '冰拿铁', '冰拿鐵', 'bīng ná tiě', 'Iced Latte', '4', 'Drink'),
  (96, '冬瓜茶', '冬瓜茶', 'dōng guā chá', 'Winter Melon Tea', '4', 'Drink'),
  (97, '酸梅汤', '酸梅湯', 'suān méi tāng', 'Plum Drink', '4', 'Drink'),
  (98, '乌梅汁', '烏梅汁', 'wū méi zhī', 'Smoked Plum Juice', '4', 'Drink'),
  (99, '招牌锅贴', '招牌鍋貼', 'zhāo pái guō tiē', 'Signature Potstickers', '5', 'Dumpling & Noodle Shop'),
  (100, '韭菜锅贴', '韭菜鍋貼', 'jiǔ cài guō tiē', 'Chive Potstickers', '5', 'Dumpling & Noodle Shop'),
  (101, '韩式辣味锅贴', '韓式辣味鍋貼', 'hán shì là wèi guō tiē', 'Korean Spicy Potstickers', '5', 'Dumpling & Noodle Shop'),
  (102, '咖喱锅贴', '咖哩鍋貼', 'gā lí guō tiē', 'Curry Potstickers', '5', 'Dumpling & Noodle Shop'),
  (103, '玉米锅贴', '玉米鍋貼', 'yù mǐ guō tiē', 'Corn Potstickers', '5', 'Dumpling & Noodle Shop'),
  (104, '田园蔬菜锅贴', '田園蔬菜鍋貼', 'tián yuán shū cài guō tiē', 'Garden Vegetable Potstickers', '5', 'Dumpling & Noodle Shop'),
  (105, '鲜虾锅贴', '鮮蝦鍋貼', 'xiān xiā guō tiē', 'Shrimp Potstickers', '5', 'Dumpling & Noodle Shop'),
  (106, '招牌水饺', '招牌水餃', 'zhāo pái shuǐ jiǎo', 'Signature Dumplings', '5', 'Dumpling & Noodle Shop'),
  (107, '韭菜水饺', '韭菜水餃', 'jiǔ cài shuǐ jiǎo', 'Chive Dumplings', '5', 'Dumpling & Noodle Shop'),
  (108, '韩式辣味水饺', '韓式辣味水餃', 'hán shì là wèi shuǐ jiǎo', 'Korean Spicy Dumplings', '5', 'Dumpling & Noodle Shop'),
  (109, '玉米水饺', '玉米水餃', 'yù mǐ shuǐ jiǎo', 'Corn Dumplings', '5', 'Dumpling & Noodle Shop'),
  (110, '鲜虾水饺', '鮮蝦水餃', 'xiān xiā shuǐ jiǎo', 'Shrimp Dumplings', '5', 'Dumpling & Noodle Shop'),
  (111, '牛肉水饺', '牛肉水餃', 'niú ròu shuǐ jiǎo', 'Beef Dumplings', '5', 'Dumpling & Noodle Shop'),
  (112, '高丽菜猪肉水饺', '高麗菜豬肉水餃', 'gāo lí cài zhū ròu shuǐ jiǎo', 'Cabbage & Pork Dumplings', '5', 'Dumpling & Noodle Shop'),
  (113, '麻酱干面', '麻醬乾麵', 'má jiàng gān miàn', 'Sesame Dry Noodles', '5', 'Dumpling & Noodle Shop'),
  (114, '炸酱干面', '炸醬乾麵', 'zhá jiàng gān miàn', 'Zha Jiang Dry Noodles', '5', 'Dumpling & Noodle Shop'),
  (115, '红油抄手干面', '紅油抄手乾麵', 'hóng yóu chāo shǒu gān miàn', 'Chili Wonton Dry Noodles', '5', 'Dumpling & Noodle Shop'),
  (116, '牛肉干面', '牛肉乾麵', 'niú ròu gān miàn', 'Beef Dry Noodles', '5', 'Dumpling & Noodle Shop'),
  (117, '麻酱汤面', '麻醬湯麵', 'má jiàng tāng miàn', 'Sesame Soup Noodles', '5', 'Dumpling & Noodle Shop'),
  (118, '榨菜肉丝汤面', '榨菜肉絲湯麵', 'zhà cài ròu sī tāng miàn', 'Pickled Mustard Pork Soup Noodles', '5', 'Dumpling & Noodle Shop'),
  (119, '牛肉汤面', '牛肉湯麵', 'niú ròu tāng miàn', 'Beef Soup Noodles', '5', 'Dumpling & Noodle Shop'),
  (120, '酸辣汤面', '酸辣湯麵', 'suān là tāng miàn', 'Hot & Sour Soup Noodles', '5', 'Dumpling & Noodle Shop'),
  (121, '红油抄手', '紅油抄手', 'hóng yóu chāo shǒu', 'Chili Wontons', '5', 'Dumpling & Noodle Shop'),
  (122, '清汤抄手', '清湯抄手', 'qīng tāng chāo shǒu', 'Wontons in Clear Broth', '5', 'Dumpling & Noodle Shop'),
  (123, '酸辣汤', '酸辣湯', 'suān là tāng', 'Hot & Sour Soup', '5', 'Dumpling & Noodle Shop'),
  (124, '玉米浓汤', '玉米濃湯', 'yù mǐ nóng tāng', 'Corn Chowder', '5', 'Dumpling & Noodle Shop'),
  (125, '紫菜蛋花汤', '紫菜蛋花湯', 'zǐ cài dàn huā tāng', 'Seaweed & Egg Drop Soup', '5', 'Dumpling & Noodle Shop'),
  (126, '牛肉汤', '牛肉湯', 'niú ròu tāng', 'Beef Soup', '5', 'Dumpling & Noodle Shop'),
  (127, '皮蛋豆腐', '皮蛋豆腐', 'pí dàn dòu fu', 'Century Egg Tofu', '5', 'Dumpling & Noodle Shop'),
  (128, '凉拌木耳', '涼拌木耳', 'liáng bàn mù ěr', 'Marinated Wood Ear', '5', 'Dumpling & Noodle Shop'),
  (129, '黄瓜', '黃瓜', 'huáng guā', 'Cucumber Salad', '5', 'Dumpling & Noodle Shop'),
  (130, '泡菜', '泡菜', 'pào cài', 'Kimchi', '5', 'Dumpling & Noodle Shop'),
  (131, '豆干', '豆干', 'dòu gān', 'Braised Tofu', '5', 'Dumpling & Noodle Shop'),
  (132, '海带芽', '海帶芽', 'hǎi dài yá', 'Seaweed Salad', '5', 'Dumpling & Noodle Shop'),
  (133, '花生米', '花生米', 'huā shēng mǐ', 'Peanuts', '5', 'Dumpling & Noodle Shop'),
  (134, '卤蛋', '滷蛋', 'lǔ dàn', 'Braised Egg', '5', 'Dumpling & Noodle Shop'),
  (135, '加辣', '加辣', 'jiā là', 'Add Spicy', '5', 'Dumpling & Noodle Shop'),
  (136, '不加葱', '不加蔥', 'bù jiā cōng', 'No Scallions', '5', 'Dumpling & Noodle Shop')
ON CONFLICT (id) DO NOTHING;
SELECT setval('flashcards_id_seq', (SELECT MAX(id) FROM flashcards));

-- 6. MASTERED CARDS
INSERT INTO mastered_cards (id, username, simplified, unit_number, mastered_at) VALUES (undefined, '', '', NULL, 'undefined') ON CONFLICT (id) DO NOTHING;
INSERT INTO mastered_cards (id, username, simplified, unit_number, mastered_at) VALUES (undefined, '', '', NULL, 'undefined') ON CONFLICT (id) DO NOTHING;
SELECT setval('mastered_cards_id_seq', (SELECT MAX(id) FROM mastered_cards));

-- 7. COMPLETED LESSONS
INSERT INTO completed_lessons (id, username, unit_numbers, time_ms, completed_at) VALUES (undefined, '', NULL, NULL, 'undefined') ON CONFLICT (id) DO NOTHING;
INSERT INTO completed_lessons (id, username, unit_numbers, time_ms, completed_at) VALUES (undefined, '', NULL, NULL, 'undefined') ON CONFLICT (id) DO NOTHING;
SELECT setval('completed_lessons_id_seq', (SELECT MAX(id) FROM completed_lessons));

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// 游戏数据存储 (简化版，实际项目应使用数据库)
const users = new Map();
const gameData = {
    monsters: [
        { id: 1, name: '史莱姆', level: 1, hp: 30, attack: 8, defense: 2, exp: 15, gold: 10, sprite: '🟢' },
        { id: 2, name: '哥布林', level: 2, hp: 50, attack: 12, defense: 4, exp: 25, gold: 18, sprite: '👹' },
        { id: 3, name: '骷髅战士', level: 3, hp: 80, attack: 18, defense: 6, exp: 40, gold: 30, sprite: '💀' },
        { id: 4, name: '火焰精灵', level: 4, hp: 120, attack: 25, defense: 8, exp: 60, gold: 45, sprite: '🔥' },
        { id: 5, name: '冰霜巨人', level: 5, hp: 200, attack: 35, defense: 12, exp: 100, gold: 80, sprite: '🧊' },
        { id: 6, name: '暗影龙', level: 10, hp: 500, attack: 80, defense: 25, exp: 300, gold: 200, sprite: '🐲' }
    ],
    items: [
        { id: 1, name: '生命药水', type: 'potion', effect: 'heal', value: 50, price: 20, description: '恢复50点生命值' },
        { id: 2, name: '魔法药水', type: 'potion', effect: 'mana', value: 30, price: 25, description: '恢复30点魔法值' },
        { id: 3, name: '铁剑', type: 'weapon', effect: 'attack', value: 10, price: 100, description: '攻击力+10' },
        { id: 4, name: '钢铁盔甲', type: 'armor', effect: 'defense', value: 8, price: 120, description: '防御力+8' },
        { id: 5, name: '魔法杖', type: 'weapon', effect: 'attack', value: 15, price: 200, description: '攻击力+15，魔法伤害' },
        { id: 6, name: '龙鳞甲', type: 'armor', effect: 'defense', value: 20, price: 500, description: '防御力+20，火焰抗性' }
    ],
    skills: [
        { id: 1, name: '火球术', type: 'attack', manaCost: 10, damage: 25, description: '发射火球攻击敌人' },
        { id: 2, name: '治疗术', type: 'heal', manaCost: 8, heal: 40, description: '恢复生命值' },
        { id: 3, name: '冰锥术', type: 'attack', manaCost: 12, damage: 30, description: '发射冰锥，有几率冰冻敌人' },
        { id: 4, name: '护盾术', type: 'buff', manaCost: 15, defense: 10, duration: 3, description: '提升防御力3回合' }
    ],
    quests: [
        { id: 1, name: '新手任务', description: '击败3只史莱姆', target: 'kill', targetId: 1, targetCount: 3, reward: { exp: 50, gold: 100 }, completed: false },
        { id: 2, name: '清理哥布林', description: '击败5只哥布林', target: 'kill', targetId: 2, targetCount: 5, reward: { exp: 100, gold: 200, item: 3 }, completed: false },
        { id: 3, name: '探索地下城', description: '击败骷髅战士', target: 'kill', targetId: 3, targetCount: 1, reward: { exp: 200, gold: 300, item: 4 }, completed: false }
    ]
};

// JWT密钥
const JWT_SECRET = 'magic-academy-secret-key';

// 身份验证中间件
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.sendStatus(401);
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// 创建默认玩家数据
const createDefaultPlayer = (username) => {
    return {
        username,
        level: 1,
        exp: 0,
        expToNext: 100,
        hp: 100,
        maxHp: 100,
        mana: 50,
        maxMana: 50,
        attack: 10,
        defense: 5,
        gold: 100,
        inventory: [
            { id: 1, count: 3 }, // 3个生命药水
            { id: 2, count: 2 }  // 2个魔法药水
        ],
        equipment: {
            weapon: null,
            armor: null
        },
        skills: [1, 2], // 默认技能：火球术和治疗术
        quests: [1], // 默认任务
        achievements: [],
        stats: {
            monstersKilled: 0,
            questsCompleted: 0,
            totalDamageDealt: 0,
            totalGoldEarned: 0
        },
        location: 'academy',
        battleState: null,
        createdAt: new Date(),
        lastLogin: new Date()
    };
};

// API路由

// 用户注册
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    if (users.has(username)) {
        return res.status(400).json({ error: '用户名已存在' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const playerData = createDefaultPlayer(username);
    
    users.set(username, {
        password: hashedPassword,
        playerData
    });

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({
        message: '注册成功',
        token,
        player: playerData
    });
});

// 用户登录
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    const user = users.get(username);
    if (!user) {
        return res.status(400).json({ error: '用户不存在' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
        return res.status(400).json({ error: '密码错误' });
    }

    user.playerData.lastLogin = new Date();
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({
        message: '登录成功',
        token,
        player: user.playerData
    });
});

// 获取玩家数据
app.get('/api/player', authenticateToken, (req, res) => {
    const user = users.get(req.user.username);
    if (!user) {
        return res.status(404).json({ error: '玩家不存在' });
    }
    
    res.json(user.playerData);
});

// 保存玩家数据
app.post('/api/player/save', authenticateToken, (req, res) => {
    const user = users.get(req.user.username);
    if (!user) {
        return res.status(404).json({ error: '玩家不存在' });
    }
    
    user.playerData = { ...user.playerData, ...req.body };
    res.json({ message: '数据保存成功' });
});

// 获取游戏数据
app.get('/api/gamedata', (req, res) => {
    res.json(gameData);
});

// 开始战斗
app.post('/api/battle/start', authenticateToken, (req, res) => {
    const { monsterId } = req.body;
    const user = users.get(req.user.username);
    const monster = gameData.monsters.find(m => m.id === monsterId);
    
    if (!monster) {
        return res.status(400).json({ error: '怪物不存在' });
    }
    
    const battleState = {
        monster: { ...monster, currentHp: monster.hp },
        player: {
            hp: user.playerData.hp,
            mana: user.playerData.mana,
            attack: user.playerData.attack,
            defense: user.playerData.defense
        },
        turn: 'player',
        round: 1
    };
    
    user.playerData.battleState = battleState;
    
    res.json({
        message: '战斗开始',
        battleState
    });
});

// 战斗行动
app.post('/api/battle/action', authenticateToken, (req, res) => {
    const { action, skillId } = req.body;
    const user = users.get(req.user.username);
    const battleState = user.playerData.battleState;
    
    if (!battleState) {
        return res.status(400).json({ error: '没有进行中的战斗' });
    }
    
    let result = { message: '', battleState, gameOver: false, victory: false };
    
    if (action === 'attack') {
        const damage = Math.max(1, user.playerData.attack - battleState.monster.defense + Math.floor(Math.random() * 10) - 5);
        battleState.monster.currentHp -= damage;
        result.message = `你对${battleState.monster.name}造成了${damage}点伤害！`;
        user.playerData.stats.totalDamageDealt += damage;
        
        if (battleState.monster.currentHp <= 0) {
            // 胜利
            const expGain = battleState.monster.exp;
            const goldGain = battleState.monster.gold;
            user.playerData.exp += expGain;
            user.playerData.gold += goldGain;
            user.playerData.stats.monstersKilled++;
            user.playerData.stats.totalGoldEarned += goldGain;
            
            // 检查升级
            if (user.playerData.exp >= user.playerData.expToNext) {
                user.playerData.level++;
                user.playerData.exp -= user.playerData.expToNext;
                user.playerData.expToNext = Math.floor(user.playerData.expToNext * 1.5);
                user.playerData.maxHp += 20;
                user.playerData.maxMana += 10;
                user.playerData.attack += 3;
                user.playerData.defense += 2;
                user.playerData.hp = user.playerData.maxHp;
                user.playerData.mana = user.playerData.maxMana;
                result.message += ` 你获得了${expGain}经验和${goldGain}金币！恭喜升级！`;
            } else {
                result.message += ` 你获得了${expGain}经验和${goldGain}金币！`;
            }
            
            user.playerData.battleState = null;
            result.gameOver = true;
            result.victory = true;
        }
    } else if (action === 'skill' && skillId) {
        const skill = gameData.skills.find(s => s.id === skillId);
        if (skill && user.playerData.skills.includes(skillId) && user.playerData.mana >= skill.manaCost) {
            user.playerData.mana -= skill.manaCost;
            
            if (skill.type === 'attack') {
                const damage = skill.damage + Math.floor(Math.random() * 10) - 5;
                battleState.monster.currentHp -= damage;
                result.message = `你使用${skill.name}对${battleState.monster.name}造成了${damage}点伤害！`;
                user.playerData.stats.totalDamageDealt += damage;
                
                if (battleState.monster.currentHp <= 0) {
                    const expGain = battleState.monster.exp;
                    const goldGain = battleState.monster.gold;
                    user.playerData.exp += expGain;
                    user.playerData.gold += goldGain;
                    user.playerData.stats.monstersKilled++;
                    user.playerData.stats.totalGoldEarned += goldGain;
                    
                    if (user.playerData.exp >= user.playerData.expToNext) {
                        user.playerData.level++;
                        user.playerData.exp -= user.playerData.expToNext;
                        user.playerData.expToNext = Math.floor(user.playerData.expToNext * 1.5);
                        user.playerData.maxHp += 20;
                        user.playerData.maxMana += 10;
                        user.playerData.attack += 3;
                        user.playerData.defense += 2;
                        user.playerData.hp = user.playerData.maxHp;
                        user.playerData.mana = user.playerData.maxMana;
                        result.message += ` 你获得了${expGain}经验和${goldGain}金币！恭喜升级！`;
                    } else {
                        result.message += ` 你获得了${expGain}经验和${goldGain}金币！`;
                    }
                    
                    user.playerData.battleState = null;
                    result.gameOver = true;
                    result.victory = true;
                }
            } else if (skill.type === 'heal') {
                const healAmount = Math.min(skill.heal, user.playerData.maxHp - user.playerData.hp);
                user.playerData.hp += healAmount;
                result.message = `你使用${skill.name}恢复了${healAmount}点生命值！`;
            }
        } else {
            return res.status(400).json({ error: '无法使用该技能' });
        }
    }
    
    // 怪物回合
    if (!result.gameOver && battleState.monster.currentHp > 0) {
        const monsterDamage = Math.max(1, battleState.monster.attack - user.playerData.defense + Math.floor(Math.random() * 6) - 3);
        user.playerData.hp -= monsterDamage;
        result.message += ` ${battleState.monster.name}对你造成了${monsterDamage}点伤害！`;
        
        if (user.playerData.hp <= 0) {
            user.playerData.hp = 0;
            user.playerData.battleState = null;
            result.message += ' 你被击败了！';
            result.gameOver = true;
            result.victory = false;
        }
    }
    
    battleState.round++;
    result.battleState = battleState;
    
    res.json(result);
});

// 使用物品
app.post('/api/inventory/use', authenticateToken, (req, res) => {
    const { itemId } = req.body;
    const user = users.get(req.user.username);
    const item = gameData.items.find(i => i.id === itemId);
    const inventoryItem = user.playerData.inventory.find(i => i.id === itemId);
    
    if (!item || !inventoryItem || inventoryItem.count <= 0) {
        return res.status(400).json({ error: '物品不存在或数量不足' });
    }
    
    let message = '';
    
    if (item.effect === 'heal') {
        const healAmount = Math.min(item.value, user.playerData.maxHp - user.playerData.hp);
        user.playerData.hp += healAmount;
        message = `使用${item.name}，恢复了${healAmount}点生命值`;
    } else if (item.effect === 'mana') {
        const manaAmount = Math.min(item.value, user.playerData.maxMana - user.playerData.mana);
        user.playerData.mana += manaAmount;
        message = `使用${item.name}，恢复了${manaAmount}点魔法值`;
    }
    
    inventoryItem.count--;
    if (inventoryItem.count <= 0) {
        user.playerData.inventory = user.playerData.inventory.filter(i => i.id !== itemId);
    }
    
    res.json({
        message,
        player: user.playerData
    });
});

// 购买物品
app.post('/api/shop/buy', authenticateToken, (req, res) => {
    const { itemId, quantity = 1 } = req.body;
    const user = users.get(req.user.username);
    const item = gameData.items.find(i => i.id === itemId);
    
    if (!item) {
        return res.status(400).json({ error: '物品不存在' });
    }
    
    const totalCost = item.price * quantity;
    if (user.playerData.gold < totalCost) {
        return res.status(400).json({ error: '金币不足' });
    }
    
    user.playerData.gold -= totalCost;
    
    const existingItem = user.playerData.inventory.find(i => i.id === itemId);
    if (existingItem) {
        existingItem.count += quantity;
    } else {
        user.playerData.inventory.push({ id: itemId, count: quantity });
    }
    
    res.json({
        message: `购买了${quantity}个${item.name}`,
        player: user.playerData
    });
});

// 获取排行榜
app.get('/api/leaderboard', (req, res) => {
    const players = Array.from(users.values()).map(user => ({
        username: user.playerData.username,
        level: user.playerData.level,
        exp: user.playerData.exp,
        gold: user.playerData.gold,
        monstersKilled: user.playerData.stats.monstersKilled
    })).sort((a, b) => b.level - a.level || b.exp - a.exp);
    
    res.json(players.slice(0, 10));
});

// Socket.IO 连接处理
io.on('connection', (socket) => {
    console.log('用户连接:', socket.id);
    
    socket.on('join', (username) => {
        socket.username = username;
        socket.join('game');
        socket.broadcast.to('game').emit('playerJoined', username);
    });
    
    socket.on('disconnect', () => {
        if (socket.username) {
            socket.broadcast.to('game').emit('playerLeft', socket.username);
        }
        console.log('用户断开连接:', socket.id);
    });
});

// 静态文件路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/game', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

app.get('/character', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'character.html'));
});

app.get('/shop', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'shop.html'));
});

app.get('/leaderboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'leaderboard.html'));
});

const PORT = process.env.PORT || 3000;

// 导出app供Vercel使用
module.exports = app;

// 本地开发时启动服务器
if (process.env.NODE_ENV !== 'production') {
    server.listen(PORT, () => {
        console.log(`魔法学院冒险记服务器运行在端口 ${PORT}`);
        console.log(`访问 http://localhost:${PORT} 开始游戏`);
    });
}
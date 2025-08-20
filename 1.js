// 假设你在浏览器或 Node.js 环境下执行
async function testEditArticle() {
    const response = await fetch('http://localhost:8000/api/edit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            slug: '1',
            title: '测试',
            content: '测试上传',
            tags: ['Node', 'Express'],
            description: '描述'
        })
    });

    const data = await response.json();
    console.log(data);
}

testEditArticle();
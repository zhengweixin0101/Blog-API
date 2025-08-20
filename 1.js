async function testEditArticle() {
    const response = await fetch('http://localhost:8000/api/edit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            slug: '1',
            //title: '测试',
            //content: '测试上传',
            date: '2025-08-20',
            //tags: ['Node', 'Express'],
            //description: '描述'
        })
    });

    const data = await response.json();
    console.log(data);
}

testEditArticle();
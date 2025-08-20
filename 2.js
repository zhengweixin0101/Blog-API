// 删除文章
async function testDeleteArticle() {
    const response = await fetch('http://localhost:8000/api/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            slug: '1' // 要删除的文章 slug
        })
    });

    const data = await response.json();
    console.log(data);
}

testDeleteArticle();

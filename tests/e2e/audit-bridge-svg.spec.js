const {test,expect}=require('@playwright/test');
test('bridge labels fit SVG viewBox at desktop and mobile sizes',async({page})=>{
 for(const id of ['error','adjust','overshoot']){
  await page.goto('/control-basics.html#'+id);
  const lesson=await page.evaluate(id=>CircuitPlainCourse.bridge.find(l=>l.id===id),id);
  await page.locator(`input[name=prediction][value=${lesson.answer}]`).check();await page.locator('#predict').click();await page.locator('#experiment-control').fill(String(lesson.target));
  const bounds=await page.locator('#bridge-plot text').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBBox();return {text:n.textContent,x:b.x,y:b.y,width:b.width,height:b.height,font:getComputedStyle(n).fontSize};}));
  expect(bounds.filter(b=>b.x<0||b.y<0||b.x+b.width>720||b.y+b.height>280)).toEqual([]);
 }
});

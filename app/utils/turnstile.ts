/*
Original: https://github.com/ZFC-Digital/puppeteer-real-browser/blob/main/lib/esm/module/turnstile.mjs
*/
async function checkTurnstile(page: any): Promise<boolean> {
  return new Promise(async (resolve, reject) => {
    var waitInterval = setTimeout(() => {
      clearInterval(waitInterval);
      resolve(false);
    }, 5000);

    try {
      const elements = await page.$$('[name="cf-turnstile-response"]');
      if (elements.length <= 0) {
        const coordinates = await page.evaluate(() => {
          let coordinates: any[] = [];
          document.querySelectorAll('div').forEach((item) => {
            try {
              let itemCoordinates = item.getBoundingClientRect();
              let itemCss = window.getComputedStyle(item);
              if (
                itemCss.margin == '0px' &&
                itemCss.padding == '0px' &&
                itemCoordinates.width > 290 &&
                itemCoordinates.width <= 310 &&
                !item.querySelector('*')
              ) {
                coordinates.push({
                  x: itemCoordinates.x,
                  y: item.getBoundingClientRect().y,
                  w: item.getBoundingClientRect().width,
                  h: item.getBoundingClientRect().height,
                });
              }
            } catch (err) {}
          });

          if (coordinates.length <= 0) {
            document.querySelectorAll('div').forEach((item) => {
              try {
                let itemCoordinates = item.getBoundingClientRect();
                if (
                  itemCoordinates.width > 290 &&
                  itemCoordinates.width <= 310 &&
                  !item.querySelector('*')
                ) {
                  coordinates.push({
                    x: itemCoordinates.x,
                    y: item.getBoundingClientRect().y,
                    w: item.getBoundingClientRect().width,
                    h: item.getBoundingClientRect().height,
                  });
                }
              } catch (err) {}
            });
          }

          return coordinates;
        });

        for (const item of coordinates) {
          try {
            let x = item.x + 30;
            let y = item.y + item.h / 2;
            await page.mouse.click(x, y);
          } catch (err) {}
        }
        return resolve(true);
      }

      for (const element of elements) {
        try {
          const parentElement = await element.evaluateHandle(
            (el: any) => el.parentElement,
          );
          const box = await parentElement.boundingBox();
          let x = box.x + 30;
          let y = box.y + box.height / 2;
          console.log(x, y);
          await page.mouse.click(x, y);
        } catch (err) {}
      }
      clearInterval(waitInterval);
      await new Promise((done) => setTimeout(done, 5000));
      resolve(true);
    } catch (err) {
      clearInterval(waitInterval);
      resolve(false);
    }
  });
}

export default checkTurnstile;

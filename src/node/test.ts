type Ext = { ext: Ext } | readonly Ext[];

// type Ext = { 
//   [key: string]: any;
//   ext: Ext 
// } | readonly Ext[];

// 库提供给用户的函数，用于创建“叶子节点”（真正的扩展）
function createExt(config: any): Ext {
  // 这个函数的返回值类型是 `Ext`
  // 但它的参数 `config` 可以是任何东西！
  return {
    // 内部实现：将 config 包装在一个只有 `ext` 属性的对象里
    ext: config // 或者其他的内部转换逻辑
  };
}

// 另一个常见的工厂函数：将多个扩展组合成一个
function combineExts(exts: readonly Ext[]): Ext {
  return exts;
}

const a: Ext = createExt({ a: "1" });
const b: Ext = createExt({ b: "2" });
const c: Ext = createExt({ c: "3" });

const chain: Ext = combineExts([a, b, c]);

const complex: Ext = combineExts([
  [a,b,c],
  chain,
  createExt({ x: "x" }),
  combineExts([
    createExt({ y: "y" }),
    createExt({ z: "z" })
  ])
]);

console.log(JSON.stringify(complex, null, 2));

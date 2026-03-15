const d3 = require('d3');

class GraphVisualizer {
  constructor(containerId) {
    this.containerId = containerId;
    this.width = 800;
    this.height = 600;
    this.svg = null;
    this.force = null;
    this.nodes = [];
    this.links = [];
  }

  visualize(graphData, onNodeClick) {
    // 清除之前的可视化
    d3.select(`#${this.containerId}`).selectAll('*').remove();

    this.nodes = graphData.nodes;
    this.links = graphData.links;

    // 创建 SVG 元素
    this.svg = d3.select(`#${this.containerId}`)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height);

    // 创建力导向图
    this.force = d3.forceSimulation(this.nodes)
      .force('link', d3.forceLink(this.links).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(this.width / 2, this.height / 2))
      .force('collision', d3.forceCollide().radius(d => {
        // 计算文本长度，为每个字符分配7像素的宽度，再加20像素的边距，取一半作为半径
        const textLength = d.name.length * 7;
        const width = Math.max(40, textLength + 20);
        return width / 2;
      }));

    // 绘制连接线
    const link = this.svg.append('g')
      .selectAll('line')
      .data(this.links)
      .enter()
      .append('line')
      .attr('stroke', '#999')
      .attr('stroke-width', 1);

    // 绘制节点
    const node = this.svg.append('g')
      .selectAll('g')
      .data(this.nodes)
      .enter()
      .append('g')
      .call(d3.drag()
        .on('start', this.dragstarted.bind(this))
        .on('drag', this.dragged.bind(this))
        .on('end', this.dragended.bind(this)))
      .on('click', (event, d) => {
        if (onNodeClick) {
          onNodeClick(d);
        }
      });

    // 为节点添加矩形框，大小根据文本长度动态调整
    node.append('rect')
      .attr('width', d => {
        // 计算文本长度，为每个字符分配7像素的宽度，再加20像素的边距
        const textLength = d.name.length * 7;
        return Math.max(40, textLength + 20);
      })
      .attr('height', 40)
      .attr('rx', 5)
      .attr('ry', 5)
      .attr('fill', d => {
        switch (d.type) {
          case 'FunctionDeclaration': return '#3498db';
          case 'FunctionExpression': return '#2ecc71';
          case 'ArrowFunctionExpression': return '#e74c3c';
          default: return '#95a5a6';
        }
      })
      .attr('transform', d => {
        // 计算文本长度，为每个字符分配7像素的宽度，再加20像素的边距
        const textLength = d.name.length * 7;
        const width = Math.max(40, textLength + 20);
        return `translate(${-width / 2}, -20)`;
      });

    // 为节点添加文本
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .attr('fill', 'white')
      .text(d => d.name);

    // 更新力导向图
    this.force.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('transform', d => `translate(${d.x},${d.y})`);
    });
  }

  dragstarted(event, d) {
    if (!event.active) this.force.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  dragended(event, d) {
    if (!event.active) this.force.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  // 调整可视化大小
  resize(width, height) {
    this.width = width;
    this.height = height;
    if (this.svg) {
      this.svg.attr('width', width).attr('height', height);
      this.force.force('center', d3.forceCenter(width / 2, height / 2));
      this.force.restart();
    }
  }

  // 生成图片
  generateImage() {
    return new Promise((resolve, reject) => {
      try {
        // 获取 SVG 元素
        const svgElement = document.querySelector(`#${this.containerId} svg`);
        if (!svgElement) {
          reject(new Error('SVG 元素不存在'));
          return;
        }

        // 将 SVG 转换为字符串
        const svgString = new XMLSerializer().serializeToString(svgElement);
        
        // 创建 Blob 对象
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);

        // 创建图片对象
        const img = new Image();
        img.onload = () => {
          // 创建 canvas
          const canvas = document.createElement('canvas');
          canvas.width = this.width;
          canvas.height = this.height;
          const ctx = canvas.getContext('2d');

          // 绘制图片
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, this.width, this.height);
          ctx.drawImage(img, 0, 0);

          // 转换为 PNG
          canvas.toBlob((pngBlob) => {
            URL.revokeObjectURL(url);
            resolve(pngBlob);
          }, 'image/png');
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('图片加载失败'));
        };
        img.src = url;
      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = GraphVisualizer;